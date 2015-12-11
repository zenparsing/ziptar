import * as Path from "node:path";
import { File } from "zen-fs";

import {

    pumpBytes,
    gunzip,
    gzip,
    sinkSource,
    forEach,

} from "streamware";

import { TarExtended } from "./TarExtended.js";
import { TarHeader } from "./TarHeader.js";
import { TarEntry } from "./TarEntry.js";
import { zeroFill, isZeroFilled, Options } from "./Utilities.js";

export class TarReader {

    constructor(stream, options = {}) {

        this.stream = stream;
        this.attributes = {};
        this.current = null;

        if (options.unzip)
            this.stream = this.stream::pumpBytes()::gunzip();
    }

    async close() {

        await this.stream.return();
    }

    static async open(path, options) {

        path = Path.resolve(path);
        return new this(await File.read(path), options);
    }

    async *entries() {

        while (true) {

            let attributes = {},
                link = null,
                path = null,
                done = false,
                entry;

            while (!done) {

                this.current = entry = await this._nextEntry();

                if (!entry)
                    return;

                switch (entry.type) {

                    case "global-attributes":
                        await this._readAttributes(entry, this.attributes);
                        break;

                    case "old-attributes":
                    case "extended-attributes":
                        await this._readAttributes(entry, attributes);
                        break;

                    case "long-link-name":
                        link = await this._readString(entry);
                        break;

                    case "long-path-name":
                    case "old-long-path-name":
                        path = await this._readString(entry);
                        break;

                    default:
                        done = true;
                        break;
                }
            }

            this._copyAttributes(this.attributes, entry);
            this._copyAttributes(attributes, entry);

            if (link) entry.linkPath = link;
            if (path) entry.name = path;

            yield entry;
        }
    }

    async _readString(entry) {

        let stream = entry.read();
        let data = (await stream.next(new Buffer(entry.size))).value;
        return data.toString("utf8").replace(/\x00/g, "");
    }

    async _readAttributes(entry, fields) {

        let stream = entry.read();
        let data = (await stream.next(new Buffer(entry.size))).value;
        return TarExtended.read(data, fields);
    }

    _copyAttributes(fields, entry) {

        Object.keys(fields).forEach(k => {

            let v = fields[k];

            switch (k) {

                case "mtime": entry.lastModified = v; break;
                case "size": entry.size = v; break;
                case "uname": entry.userName = v; break;
                case "uid": entry.userID = v; break;
                case "gname": entry.groupName = v; break;
                case "gid": entry.groupID = v; break;
                case "linkpath": entry.linkPath = v; break;
                case "path": entry.name = v; break;
            }

            entry.attributes[k] = v;

        });
    }

    async _nextEntry() {

        let buffer = new Buffer(512),
            block;

        // Completely read current entry before advancing
        if (this.current)
            for await (block of this.current.read());

        while (true) {

            block = (await this.stream.next(buffer)).value;

            if (!block)
                return null;

            if (!isZeroFilled(block))
                break;
        }

        let header = TarHeader.fromBuffer(block),
            entry = new TarEntry;

        // Copy properties from the header
        Object.keys(header).forEach(k => entry[k] = header[k]);
        entry.stream = this.stream;

        return entry;
    }

}

export class TarWriter {

    constructor(writer, options = {}) {

        let { sink, source } = sinkSource();

        this.stream = sink;

        if (options.zip)
            source = source::gzip()::pumpBytes();

        this.done = (async _=> {

            try {

                // TODO:  If we throw here, then somehow this.stream.next calls
                // never resolve.  Figure out why, and what the solution should be.

                for await (let chunk of source)
                    await writer.write(chunk);

            } finally {

                await writer.close();
            }

        })();
    }

    async close() {

        // Tar archive ends with two zero-filled blocks
        await this.stream.next(zeroFill(1024));
        await this.stream.return();
        await this.done;
    }

    createEntry(name) {

        let entry = new TarEntry(name);
        entry.stream = this.stream;
        return entry;
    }

    static async open(path, options) {

        path = Path.resolve(path);
        return new this(await File.openWrite(path), options);
    }

}
