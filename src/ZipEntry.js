import { ZipDataHeader } from "ZipDataHeader.js";
import { ZipDataDescriptor } from "ZipDataDescriptor.js";
import { Crc32, normalizePath } from "Utilities.js";
import { BufferWriter } from "BufferWriter.js";
import { BufferReader } from "BufferReader.js";
import { InflateStream, DeflateStream } from "Compression.js";
import { CopyStream } from "CopyStream.js";
import { Pipe } from "Pipe.js";

var STORED = 0,
    DEFLATED = 8,
    NO_LOCAL_SIZE = 8,
    MADE_BY_UNIX = 789;
    
class ZipEntry {

    constructor() {
        
        this.name = "";
        this.versionMadeBy = MADE_BY_UNIX;
        this.version = 20;
        this.flags = NO_LOCAL_SIZE;
        this.method = DEFLATED;
        this.lastModified = new Date(0);
        this.crc32 = 0;
        this.compressedSize = 0;
        this.size = 0;
        this.startDisk = 0;
        this.internalAttributes = 0;
        this.attributes = 0;
        this.offset = 0;
        this.extra = null;
        this.comment = "";
        this.stream = null;
    }
    
    get name() { return this._name }
    set name(value) { this._name = normalizePath(value || "") }
    
    get isDirectory() { return this.name.endsWith("/") }
    get isFile() { return !this.name.endsWith("/") }
}

export class ZipEntryReader extends ZipEntry {

    async open() {
    
        if (this.isDirectory)
            throw new Error("Cannot open a directory entry");
        
        if (!this.stream)
            throw new Error("No input stream");
        
        var buffer, dataHeader;
        
        // Read the data header
        await this.stream.seek(this.offset);
        buffer = await this.stream.read(new Buffer(ZipDataHeader.LENGTH));
        dataHeader = ZipDataHeader.fromBuffer(buffer);
        
        // Advance to the file contents
        await this.stream.seek(this.offset + dataHeader.headerSize);
        
        var zipStream, crc;
        
        // Create decompression stream
        switch (this.method) {
        
            case STORED:
                zipStream = new CopyStream;
                break;
                
            case DEFLATED:
                zipStream = new InflateStream;
                crc = new Crc32;
                break;
            
            default:
                throw new Error("Unsupported compression method");
        }
        
        var bytesLeft = this.compressedSize;
        
        // Create a pipe from the input to the decompressor
        var pipe = new Pipe(this.stream, {
        
            transform: data => {
            
                // End the stream if file has been read
                if (bytesLeft === 0)
                    return null;
                
                // Only read the remaining data for this file
                if (bytesLeft < data.length)
                    data = data.slice(0, bytesLeft);
                
                bytesLeft -= data.length;
                
                return data;
            }
            
        });
        
        pipe.connect(zipStream, true);
        pipe.start();
        
        // Return a stream for reading
        return {
        
            read: buffer => {
            
                var read = await zipStream.read(buffer);
                
                // Perform checksum calculation
                if (crc) {
                
                    if (read) {
                    
                        crc.accumulate(read);
                    
                    } else {
                    
                        if (crc.value !== this.crc32)
                            throw new Error("Invalid checksum");
                        
                        crc = null;
                    }
                }
                
                return read;
            }
            
        };
    }
    
}

export class ZipEntryWriter extends ZipEntry {

    constructor(name) {
    
        super();
        
        this.name = name;
        
        // Set appropriate defaults for directories
        if (this.isDirectory) {
        
            this.version = 10;
            this.flags = 0;
            this.method = STORED;
        }
    }
    
    async open() {
    
        if (!this.stream)
            throw new Error("No output stream");
        
        if (this.isDirectory)
            return this._openDirectory();
        
        var zipStream, crc;
        
        // Create the compression stream
        switch (this.method) {
        
            case STORED:
                zipStream = new CopyStream;
                break;
            
            case DEFLATED:
                zipStream = new DeflateStream;
                crc = new Crc32;
                break;
            
            default:
                throw new Error("Unsupported compression method");
        }
        
        // Store the output position
        this.offset = this.stream.position;
        this.size = 0;
        this.compressedSize = 0;
        
        // Write the data header
        await this.stream.write(this._packDataHeader());
        
        var pipe = new Pipe(zipStream, {
        
            transform: data => {
            
                // Record the size of the compressed data
                this.compressedSize += data.length;
                
                return data;
            }
            
        });
        
        pipe.connect(this.stream, false);
        var pipeDone = pipe.start();
        
        // Return a stream for writing
        return {
            
            write: buffer => { 

                // Record the size of the raw data
                this.size += buffer.length;
                
                // Perform checksum calculation
                if (crc)
                    crc.accumulate(buffer);
                
                return await zipStream.write(buffer);
            },
            
            end: $=> {
                
                await zipStream.end();
                await pipeDone;
                
                // Store checksum value
                this.crc32 = crc ? crc.value : 0;
                
                await this.stream.write(this._packDataDescriptor());
            }
        };
    }
    
    async _openDirectory() {
    
        // Write the data header
        await this.stream.write(this._packDataHeader());
        
        // Return a no-op write stream
        return {
        
            write: $=> { throw await new Error("Cannot write to a directory entry") },
            end: $=> { await null }
        }
    }
    
    _packDataHeader() {
    
        var buffer = ZipDataHeader.fromEntry(this).write();
        var w = new BufferWriter(buffer.slice(ZipDataHeader.LENGTH));
    
        if (this.name) w.writeString(this.name);
        if (this.extra) w.write(this.extra);
        
        return buffer;
    }
    
    _packDataDescriptor() {
    
        return ZipDataDescriptor.fromEntry(this).write();
    }
}
