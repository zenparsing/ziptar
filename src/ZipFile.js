module Path from "node:path";

import { AsyncFS } from "package:zen-bits";
import { ZipEndHeader as EndHeader } from "ZipEndHeader.js";
import { ZipEntry } from "ZipEntry.js";
import { FileStream } from "FileStream.js";

var BUFFER_SIZE = 16 * 1024;

function dirname(path) {

    return path.replace(/[^\/]+(\/)?$/, "");
}

// Creates a directory, if it doesn't already exist
async createDirectory(path) {

    var stat;
    
    try { stat = await AsyncFS.stat(path); }
    catch (x) {}
    
    // Verify that destination is not something other than a directory
    if (stat && !stat.isDirectory())
        throw new Error("Path is not a directory");
    
    // Create directory if necessary
    if (!stat)
        await AsyncFS.mkdir(path);
}

export class ZipFile {

    constructor() {

        this.fileStream = new FileStream;
        this.comment = "";
        this.entries = [];
        this.entryTable = {};
    }
    
    get file() { return this.fileStream.file; }
    get size() { return this.fileStream.size; }
    
    getEntryNames() {
    
        return Object.keys(this.entryTable);
    }
    
    hasEntry(name) {
    
        return typeof this.entryTable[name] === "number";
    }
    
    getChildEntryNames(name) {
    
        return this.entries.filter(path => path !== name && path.indexOf(name) === 0);
    }
    
    getEntry(name) {
    
        var index = this.entryTable[name];
        
        if (typeof index !== "number")
            throw new Error("Entry not found");
        
        return this.entries[index];
    }
    
    deleteEntry(name) {
    
        var index = this.entryTable[name];
        
        if (typeof index === "number") {
        
            delete this.entryTable[name];
            this.entries.splice(index, 1);
        }
        
        // Delete child entries
        this.getChildEntryNames(name).forEach(path => {
        
            index = this.entryTable[path];
            
            delete this.entryTable[name];
            this.entries.splice(index, 1);
        });
    }
    
    setEntry(entry) {
    
        var d = entry.name;
        
        // Add entries for parent directories
        while (d = dirname(d))
            if (!this.hasEntry(d))
                this.setEntry(new ZipEntry(d));
        
        var index = this.entryTable[entry.name];
        
        if (typeof index !== "number")
            index = this.entries.length;
        
        this.entries[index] = entry;
        this.entryTable[entry.name] = index;
    }
    
    async addFile(path, dest) {
    
        path = Path.resolve(path);
        dest = this._destination(dest);
        
        var base = Path.basename(path),
            stat = await AsyncFS.stat(path),
            isDir = stat.isDirectory();
        
        if (!isDir && !stat.isFile())
            throw new Error("Invalid path");
        
        var entry = new ZipEntry(dest + base + (isDir ? "/" : ""));
        entry.lastModified = stat.mtime;
        entry.source = path;
        
        this.setEntry(entry);
        
        if (isDir) {
        
            var list = (await AsyncFS.readdir(path))
                .filter(item => item !== ".." && item !== ".")
                .map(item => Path.join(path, item));
            
            return this.addFiles(list, entry.name);
        }
        
        return this;
    }
    
    async addFiles(list, dest) {
    
        dest = this._destination(dest);
        
        if (typeof list === "string")
            list = [list];
        
        for (var i = 0; i < list.length; ++i)
            await this.addFile(list[i], dest);
        
        return this;
    }
    
    async write(dest) {
    
        dest = Path.resolve(dest);
        
        // Sort entries so that already compressed entries come first 
        var list = this.getEntryNames().sort((a, b) => {
        
            if (a.source && !b.source)
                return 1;
            
            if (b.source && !a.source)
                return -1;
            
            return a.toLowerCase().localeCompare(b.toLowerCase());
        });
        
        var outStream = await new FileStream().open(dest, "w"),
            buffer = this._createBuffer(),
            queue = list.slice(0),
            entry,
            file,
            inStream,
            i;
        
        // Compress all files
        for (i = 0; i < queue.length; ++i) {
        
            entry = this.getEntry(queue[i]);
            
            if (entry.source === dest)
                throw new Error("Cannot compress the destination file");
            
            if (entry.isDirectory) {
            
                // Write header for directories
                await outStream.write(entry.packDataHeader());
            
            } else {
            
                // Compress file
                file = new FileStream();
                inStream = await file.open(entry.source);
                
                await entry.compress(inStream, outStream, buffer);
                await file.close();
            }
        }
        
        var start = outStream.position;
        
        // Write central directory
        for (i = 0; i < list.length; ++i)
            await outStream.write(this.getEntry(list[i]).packHeader());
        
        // Pack end of central directory 
        var endHeader = EndHeader.toBuffer({
        
            volumeEntries: list.length,
            totalEntries: list.length,
            size: outStream.position - start,
            offset: start,
            commentLength: Buffer.byteLength(this.comment)
            
        });
                
        // Add comment
        endHeader.write(this.comment, EndHeader.LENGTH);
    
        // Write end-of-central-directory header and close file
        await outStream.write(endHeader);
        await outStream.close();
        
        return this;
    }
    
    async close() {
    
        await this.fileStream.close();
        return this;
    }
    
    async extractAll(dest) {
    
        await this.extractDirectory("", dest);
        return this;
    }
    
    async extractDirectory(name, dest) {
    
        dest = Path.resolve(dest);
        
        this._assertOpen();
        
        var buffer = this._createBuffer(),
            names;
        
        if (name = name || "") {
        
            // Verify the entry is a directory
            if (!this.getEntry(name).isDirectory)
                throw new Error("Entry is not a directory");
            
            // Get the names that are children of this entry
            names = this.getChildEntryNames(path);
            
        } else {
        
            // Get all entries
            names = this.getEntryNames();
        }
        
        // Sort alphabetically to ensure that directories come before their contents
        names = names.sort();
        
        // Create the directory
        await createDirectory(dest);
        
        var entryName,
            entry,
            outName,
            i;
            
        for (i = 0; i < names.length; ++i) {
        
            // TODO:  what happens if entryName is malformed?  An absolute path?
            entryName = names[i];
            entry = this.getEntry(entryName);
            outName = Path.join(dest, entryName.slice(name.length));
            
            if (entry.isDirectory) {
            
                // Create the directory
                await createDirectory(outName);
                
            } else {
            
                // Create the output file
                await this.extractFile(entry.name, outName, buffer);
            }
        }
        
        return this;
    }
    
    async extractFile(name, dest, buffer) {
    
        dest = Path.resolve(dest);
        
        this._assertOpen();
        
        var entry = this.getEntry(name),
            buffer = buffer || this._createBuffer(),
            outStream = new FileStream;
        
        await outStream.open(dest, "w");
        await entry.extract(this.fileStream, outStream, buffer);
        await outStream.close();
        await AsyncFS.utimes(dest, new Date(), entry.lastModified);
        
        return this;
    }
    
    // Opens a zip file and reads the central directory
    async open(path) {
    
        path = Path.resolve(path);
        
        var file = this.fileStream,
            endOffset;
        
        await file.open(path);
            
        // === Read the Index Header ===
        
        var end = file.size - EndHeader.LENGTH, // Last possible location of start of end header
            start = Math.max(0, end - 0xffff); // First possible location of start of end header
        
        file.seek(start);
        
        // Read the end-of-central-directory header
        var buffer = await file.readBytes(file.size - start),
            offset = -1,
            i;
        
        // Search backward until we find the start of the header
        for (i = end - start; i >= 0; --i) {
        
            // Skip if byte is not "P"
            if (buffer[i] != 0x50) 
                continue;
            
            // Look for header start value
            if (buffer.readUInt32LE(i) === EndHeader.SIGNATURE) {
            
                offset = i;
                break;
            }
        }
        
        if (offset === -1)
            throw new Error("Cannot find header start");
        
        endOffset = start + offset;
        
        // Read header
        var header = EndHeader.fromBuffer(buffer, offset);
        
        // Read optional comment
        if (header.commentLength) {
        
            offset += EndHeader.LENGTH;
            this.comment = buffer.toString("utf8", offset, offset + header.commentLength);
        }
        
        // === Read the Entry Headers ===
        
        file.seek(header.offset);
        
        // Read all file entires into a single buffer
        buffer = await file.readBytes(endOffset - header.offset);
            
        var count = 0,
            entry;
            
        // Read each file entry
        for (i = 0; i < header.volumeEntries; ++i) {
        
            entry = new ZipEntry();
            buffer = buffer.slice(count);
            count = entry.readHeader(buffer);
            
            this.setEntry(entry);
        }
        
        return this;
    }
    
    _assertOpen() {
    
        if (!this.file)
            throw new Error("No open file");
    }
    
    _destination(name) {
    
        if (name) {
        
            if (!name.endsWith("/"))
                name += "/";
            
            if (!this.hasEntry(name))
                throw new Error("Invalid destination");
            
        } else {
        
            name = "";
        }
        
        return name;
    }
    
    _createBuffer() {
    
        return new Buffer(Math.min(BUFFER_SIZE, this.fileStream.size || BUFFER_SIZE));
    }
}
