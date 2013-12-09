module FS from "node:fs";

import { PromiseExtensions } from "package:zen-bits";
import { DataHeader } from "DataHeader.js";
import { DataDescriptor } from "DataDescriptor.js";
import { EntryHeader } from "EntryHeader.js";
import { Crc32 } from "Utilities.js";
import { BufferWriter } from "BufferWriter.js";
import { InflateStream, DeflateStream, NullStream } from "ZipStream.js";

var STORED = 0,
    DEFLATED = 8,
    NO_LOCAL_SIZE = 8,
    MADE_BY_UNIX = 789;
    
export class ZipEntry {

    constructor(name) {
        
        this.versionMadeBy = MADE_BY_UNIX;
        this.version = 10;
        this.flags = 0;
        this.method = 0;
        this.lastModified = new Date(0);
        this.crc32 = 0;
        this.compressedSize = 0;
        this.size = 0;
        this.diskNumStart = 0;
        this.inAttr = 0;
        this.attr = 0;
        this.offset = 0;
        
        this.name = name || "";
        this.extra = null;
        this.comment = "";
        
        this.source = null;
        
        if (!this.isDirectory) {
        
            this.version = 20;
            this.flags = NO_LOCAL_SIZE;
            this.method = DEFLATED;
        }
    }
    
    get isDirectory() {
    
        return this.name.endsWith("/");
    }
    
    readHeader(buffer) {
    
        // Read the fixed-size portion of the header
        var header = EntryHeader.fromBuffer(buffer),
            offset = EntryHeader.LENGTH;
        
        // Set entry fields
        Object.keys(header).forEach(key => {
        
            if (this[key] !== void 0)
                this[key] = header[key];
        });
            
        // Read file name field
        if (header.fileNameLength) {
        
            this.name = buffer.toString("utf8", offset, offset += header.fileNameLength);
        }
        
        // Read extra data fields
        if (header.extraLength) {
        
            this.extra = new Buffer(header.extraLength);
            buffer.copy(this.extra, 0, offset, offset += header.extraLength);
        }
        
        // Read entry comment
        if (header.commentLength) {
        
            this.comment = buffer.toString("utf8", offset, offset += header.commentLength);
        }
        
        return offset;
    }
    
    packHeader() {
    
        this._setLengthFields();
    
        var buffer = EntryHeader.toBuffer(this),
            writer = new BufferWriter(buffer);
        
        writer.position = EntryHeader.LENGTH;
        
        this.name && writer.writeString(this.name);
        this.extra && writer.write(this.extra);
        this.comment && writer.writeString(this.comment);
        
        return buffer;
    }
    
    packDataHeader() {
    
        this._setLengthFields();
        
        var buffer = DataHeader.toBuffer(this),
            writer = new BufferWriter(buffer);
        
        writer.position = DataHeader.LENGTH;
        
        this.name && writer.writeString(this.name);
        this.extra && writer.write(this.extra);
        
        return buffer;
    }
    
    packDataDescriptor() {
    
        return DataDescriptor.toBuffer(this);
    }
    
    compress(inStream, outStream, buffer) {
    
        if (this.isDirectory)
            throw new Error("Entry is not a file");
        
        var crc = new Crc32(),
            compressed = 0,
            size = 0,
            abort = false,
            zipStream;
        
        // Create the compression stream
        switch (this.method) {
        
            case STORED:
                zipStream = new NullStream;
                break;
            
            case DEFLATED:
                zipStream = new DeflateStream;
                break;
            
            default:
                throw new Error("Unsupported compression method");
        }
        
        zipStream.on("data", event => {
        
            var data = event.data;
            
            // Accumulate data for the compressed output
            compressed += data.length;
            
            var temp = new Buffer(data.length);
            data.copy(temp);
            
            outStream.write(temp);
        });
        
        // Store the output position
        this.offset = outStream.position;
        
        // Write the data header and start the read loop
        return outStream.write(this.packDataHeader()).then($=> {
        
            // Begin the read loop
            return PromiseExtensions.iterate(stop => {
            
                // Read into the buffer
                return inStream.read(buffer).then(count => {
                    
                    // Stop loop if no more input is found
                    if (count === 0)
                        return stop(zipStream.end());
                    
                    var data = buffer.slice(0, count);
                    
                    // Accumulate data for the raw input
                    crc.accumulate(data);
                    size += count;
                    
                    // Write data into compression stream
                    return zipStream.write(data);
                });
            });
          
        }).then($=> {
        
            // Set entry data
            this.crc32 = crc.value;
            this.compressedSize = compressed;
            this.size = size;
            
            // Write the data descriptor
            return outStream.write(this.packDataDescriptor()).then($=> this);
        });
    }
    
    extract(fileStream, outStream, buffer) {
    
        if (this.isDirectory)
            throw new Error("Entry is not a file");
        
        var abort = false,
            zipStream,
            crc;
        
        // Start reading from data header
        fileStream.seek(this.offset);
        
        return fileStream.read(buffer, 0, DataHeader.LENGTH).then(count => {
        
            // === Read the Data Header ===
            
            var dataHeader = DataHeader.fromBuffer(buffer),
                crc;
            
            fileStream.seek(this.offset + dataHeader.headerSize);
            
            // Create decompression stream
            switch (this.method) {
            
                case STORED:
                
                    zipStream = new NullStream;
                    break;
                    
                case DEFLATED:
                
                    zipStream = new InflateStream;
                    crc = new Crc32();
                    break;
                
                default:
                
                    throw new Error("Unsupported compression method");
            }
            
            zipStream.on("data", event => {
            
                // Calculate CRC-32 on each chunk of decompressed data
                if (crc) 
                    crc.accumulate(event.data);
                
                var temp = new Buffer(event.data.length);
                event.data.copy(temp);
                
                outStream.write(temp);
            });
            
        }).then($=> {
            
            // === Decompress Data ==
            
            var end = fileStream.position + this.compressedSize;
            
            return PromiseExtensions.iterate(stop => {
            
                var length = Math.min(buffer.length, end - fileStream.position);
                
                // Read the next chunk
                return fileStream.read(buffer, 0, length).then(count => {
                    
                    // Write chunk into decompressor
                    return zipStream.write(buffer.slice(0, count)).then(data => {
                    
                        if (fileStream.position >= end)
                            return stop(zipStream.end());
                        
                        return data;
                    });
                });
            });
            
        }).then($=> {
        
            // === Finalize ===
            
            // Validate CRC-32
            if (crc && crc.value !== this.crc32)
                throw new Error("CRC-32 check failed.");
            
            // Close the output stream
            return outStream.end().then($=> this);
        });
    }
    
    _setLengthFields() {
    
        this.fileNameLength = Buffer.byteLength(this.name);
        this.extraLength = this.extra ? this.extra.length : 0;
        this.commentLength = Buffer.byteLength(this.comment);
    }

}
