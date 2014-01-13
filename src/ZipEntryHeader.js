import { fromZipTime, toZipTime } from "Utilities.js";
import { BufferWriter } from "BufferWriter.js";
import { BufferReader } from "BufferReader.js";

var FIXED_LENGTH = 46,
    SIGNATURE = 0x02014b50; // "PK\001\002"

export var ZipEntryHeader = {

    fromBuffer(buffer, entry) {
    
        var r = new BufferReader(buffer);
        
        if (r.readUInt32LE() !== SIGNATURE)
            throw new Error("Invalid CEN header");
                
        entry.versionMadeBy = r.readUInt16LE();
        entry.version = r.readUInt16LE();
        entry.flags = r.readUInt16LE();
        entry.method = r.readUInt16LE();
        entry.lastModified = fromZipTime(r.readUInt32LE());
        entry.crc32 = r.readUInt32LE();
        entry.compressedSize = r.readUInt32LE();
        entry.size = r.readUInt32LE();
        
        var fileNameLength = r.readUInt16LE();
        var extraLength = r.readUInt16LE();
        var commentLength = r.readUInt16LE();
        
        entry.startDisk = r.readUInt16LE();
        entry.internalAttributes = r.readUInt16LE();
        entry.attributes = r.readUInt32LE();
        entry.offset = r.readUInt32LE();
        
        entry.name = fileNameLength ? r.readString(fileNameLength) : "";
        entry.extra = extraLength ? r.read(extraLength) : null;
        entry.comment = commentLength ? r.readString(commentLength, "utf8") : "";
        
        return r.position;
    },
    
    toBuffer(entry) {
    
        var fileNameLength = Buffer.byteLength(entry.name);
        var extraLength = entry.extra ? entry.extra.length : 0;
        var commentLength = Buffer.byteLength(this.comment);
    
        var w = new BufferWriter(new Buffer(
            FIXED_LENGTH + 
            fileNameLength + 
            extraLength + 
            commentLength));
        
        w.writeUInt32LE(SIGNATURE);
        w.writeUInt16LE(entry.versionMadeBy);
        w.writeUInt16LE(entry.version);
        w.writeUInt16LE(entry.flags);
        w.writeUInt16LE(entry.method);
        w.writeUInt32LE(toZipTime(entry.lastModified));
        w.writeInt32LE(entry.crc32, true);
        w.writeUInt32LE(entry.compressedSize);
        w.writeUInt32LE(entry.size);
        w.writeUInt16LE(fileNameLength);
        w.writeUInt16LE(extraLength);
        w.writeUInt16LE(commentLength);
        w.writeUInt16LE(entry.startDisk);
        w.writeUInt16LE(entry.internalAttributes);
        w.writeUInt32LE(entry.attributes);
        w.writeUInt32LE(entry.offset);
        
        if (fileNameLength) w.writeString(entry.name);
        if (extraLength) w.write(entry.extra);
        if (commentLength) w.writeString(entry.comment);
        
        return w.buffer;
    }
};
