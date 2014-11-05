import { limitBytes, pumpBytes } from "streamware";

import { TarHeader } from "./TarHeader.js";
import { TarExtended } from "./TarExtended.js";
import { normalizePath, zeroFill } from "./Utilities.js";

const
    OCTAL_755 = 493,
    OCTAL_644 = 420;

const NO_SIZE = {

    "link": 1,
    "symlink": 1,
    "character-device": 1,
    "block-device": 1,
    "directory": 1,
    "fifo": 1
};

function fillLength(size) {

    return 512 - (size % 512 || 512);
}

class TarEntry {

    constructor() {

        this.name = "";
        this.mode = OCTAL_644;
        this.userID = 0;
        this.groupID = 0;
        this.size = 0;
        this.lastModified = new Date;
        this.type = "file";
        this.linkPath = "";
        this.userName = "";
        this.groupName = "";
        this.deviceMajor = 0;
        this.deviceMinor = 0;
        this.attributes = {};

        this.stream = null;
    }

    get name() { return this._name }
    set name(value) { this._name = normalizePath(value || "") }

    get isDirectory() {

        switch (this.type) {

            case "directory":
            case "gnu-directory": return true;
            default: return false;
        }
    }

    get isFile() {

        switch (this.type) {

            case "file":
            case "contiguous-file": return true;
            default: return false;
        }
    }

}

export class TarEntryReader extends TarEntry {

    constructor() {

        super();
        this.reading = false;
    }

    async *read() {

        if (!this.stream)
            throw new Error("No input stream");

        // Stream is forward-only:  it can only be read once
        if (this.reading)
            return;

        this.reading = true;

        let remaining = NO_SIZE[this.type] ? 0 : this.size,
            fillBytes = fillLength(remaining);

        // Read data blocks
        for async (let chunk of this.stream::limitBytes(remaining)::pumpBytes())
            yield chunk;

        // Read past block padding
        for async (let chunk of this.stream::limitBytes(fillBytes)::pumpBytes());
    }

}

export class TarEntryWriter extends TarEntry {

    constructor(name) {

        super();
        this.name = name;

        if (this.name.endsWith("/")) {

            this.type = "directory";
            this.mode = OCTAL_755;
        }
    }

    async write(input = []) {

        if (!this.stream)
            throw new Error("No output stream");

        let header = TarHeader.fromEntry(this),
            extended = header.getOverflow();

        // Copy attributes to extended collection
        Object.keys(this.attributes).forEach(k => extended[k] = this.attributes[k]);

        // Write the extended header
        if (Object.keys(extended).length > 0)
            await this._writeExtended(extended);

        // Write the entry header
        await this.stream.next(header.write());

        let remaining = NO_SIZE[this.type] ? 0 : this.size;
        remaining += fillLength(remaining);

        for async (let chunk of input) {

            remaining -= chunk.length;

            if (remaining < 0)
                throw new Error("Invalid entry length");

            await this.stream.next(chunk);
        }

        if (remaining > 0) {

            let empty = zeroFill(Math.min(remaining, 8 * 1024));

            while (remaining > 0) {

                let data = remaining < empty.length ? empty.slice(0, remaining) : empty;
                await this.stream.next(data);
                remaining -= data.length;
            }
        }
    }

    async _writeExtended(fields) {

        // Don't write extended attributes for attributes entries
        switch (this.type) {

            case "extended-attributes":
            case "global-attributes":
            case "old-extended-attributes":
                return;
        }

        let data = TarExtended.write(fields),
            entry = new TarEntryWriter("PaxExtended/" + this.name);

        entry.type = "extended-attributes";
        entry.stream = this.stream;
        entry.size = data.length;

        await entry.write([data]);
    }

}
