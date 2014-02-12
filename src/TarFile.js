module Path from "node:path";

import { FileStream } from "FileStream.js";
import { TarExtended } from "TarExtended.js";
import { TarHeader } from "TarHeader.js";
import { TarEntryReader, TarEntryWriter } from "TarEntry.js";
import { GZipStream, GUnzipStream } from "Compression.js";
import { CopyStream } from "CopyStream.js";
import { Pipe } from "Pipe.js";
import { zeroFill, isZeroFilled, Options } from "Utilities.js";

export class TarReader {

    constructor(fileStream, options) {
    
        this.file = fileStream;
        this.attributes = {};
        this.stream = this.file;
        this.current = null;
        
        var opt = new Options(options),
            pipe;
        
        if (opt.get("unzip")) {
        
            var unzipStream = new GUnzipStream;
            
            pipe = new Pipe(this.stream);
            pipe.connect(unzipStream, true);
            pipe.start();
            
            this.stream = unzipStream;
        }
        
        var blockStream = new CopyStream;
        
        pipe = new Pipe(this.stream);
        pipe.connect(blockStream, true);
        pipe.start();
        
        this.stream = blockStream;
    }
    
    async close() {
    
        await this.file.close();
        
        // TODO: Should we be waiting on pipes as well?
    }
    
    static async open(path, unzip) {
    
        path = Path.resolve(path);
        return new this(await FileStream.open(path, "r"), unzip);
    }
    
    async nextEntry() {
    
        var attributes = {},
            link = null,
            path = null,
            done = false,
            entry;
        
        while (!done) {
        
            entry = await this._nextEntry();
            
            this.current = entry;
            
            if (!entry)
                return null;
        
            switch (entry.type) {
    
                case "global-attributes": 
                    this._readAttributes(entry, this.attributes);
                    break;
            
                case "old-attributes":
                case "extended-attributes":
                    this._readAttributes(entry, attributes);
                    break;
                
                case "long-link-name": 
                    link = this._readString(entry);
                    break;
            
                case "long-path-name":
                case "old-long-path-name": 
                    path = this._readString(entry);
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
        
        return entry;
    }
    
    async _readString(entry) {
    
        var data = await entry.read(new Buffer(entry.size));
        return data.toString("utf8");
    }
    
    async _readAttributes(entry, fields) {
    
        var data = await entry.read(new Buffer(entry.size));
        return TarExtended.read(data, fields);
    }
    
    _copyAttributes(fields, entry) {
    
        Object.keys(fields).forEach(k => {
            
            var v = fields[k];
            
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
    
        var buffer = new Buffer(512),
            block;
        
        // Completely read current entry before advancing
        if (this.current) {
        
            var reader = await this.current.open();
            while (await reader.read(buffer)) {}
        }
        
        while (true) {
        
            block = await this.stream.read(buffer);
            
            if (!block)
                return null;
        
            if (!isZeroFilled(block))
                break;
        }
        
        var header = TarHeader.fromBuffer(block),
            entry = new TarEntryReader;
        
        // Copy properties from the header
        Object.keys(header).forEach(k => entry[k] = header[k]);
        entry.stream = this.stream;
        
        return entry;
    }
    
}

export class TarWriter {

    constructor(fileStream, options) {
    
        this.file = fileStream;
        this.stream = fileStream;
        
        var opt = new Options(options);
        
        if (opt.get("zip")) {
        
            var zipStream = new GZipStream,
                pipe = new Pipe(zipStream);
            
            pipe.connect(this.stream, true);
            pipe.start();
            
            this.stream = zipStream;
        }
    }
    
    async close() {
    
        // Tar archive ends with two zero-filled blocks
        await this.stream.write(zeroFill(1024));
        
        await this.stream.end();
        
        // TODO: Should we be waiting on pipes, as well?
    }
    
    createEntry(name) {
    
        var writer = new TarEntryWriter(name);
        writer.stream = this;
        return writer;
    }
    
    static async open(path, options) {
    
        path = Path.resolve(path);
        return new this(await FileStream.open(path, "w"), options);
    }
    
}

