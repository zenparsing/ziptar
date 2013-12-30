import { toZipTime, fromZipTime } from "Utilities.js";

var LOCHDR = 30, // LOC header size
    LOCSIG = 0x04034b50, // "PK\003\004"
    LOCVER = 4,	// version needed to extract
    LOCFLG = 6, // general purpose bit flag
    LOCHOW = 8, // compression method
    LOCTIM = 10, // modification time (2 bytes time, 2 bytes date)
    LOCCRC = 14, // uncompressed file crc-32 value
    LOCSIZ = 18, // compressed size
    LOCLEN = 22, // uncompressed size
    LOCNAM = 26, // filename length
    LOCEXT = 28; // extra field length

export var DataHeader = {

    fromBuffer(data, offset) {
    
        if (offset)
            data = data.slice(offset);
        
        if (data.length < LOCHDR || data.readUInt32LE(0) != LOCSIG)
            throw new Error("Invalid LOC header");
        
        return {
        
            version: data.readUInt16LE(LOCVER),
            flags: data.readUInt16LE(LOCFLG),
            method: data.readUInt16LE(LOCHOW),
            lastModified: fromZipTime(data.readUInt32LE(LOCTIM)),
            crc32: data.readUInt32LE(LOCCRC),
            compressedSize: data.readUInt32LE(LOCSIZ),
            size: data.readUInt32LE(LOCLEN),
            fileNameLength: data.readUInt16LE(LOCNAM),
            extraLength: data.readUInt16LE(LOCEXT),
            
            get headerSize() { return LOCHDR + this.variableSize; },
            get variableSize() { return this.fileNameLength + this.extraLength; }
        };
    },
    
    toBuffer(fields) {
    
        var data = new Buffer(LOCHDR + fields.fileNameLength + fields.extraLength);
        
        data.writeUInt32LE(LOCSIG, 0);
        data.writeUInt16LE(fields.version, LOCVER);
        data.writeUInt16LE(fields.flags, LOCFLG);
        data.writeUInt16LE(fields.method, LOCHOW);
        data.writeUInt32LE(toZipTime(fields.lastModified), LOCTIM);
        data.writeUInt32LE(fields.crc32, LOCCRC);
        data.writeUInt32LE(fields.compressedSize, LOCSIZ);
        data.writeUInt32LE(fields.size, LOCLEN);
        data.writeUInt16LE(fields.fileNameLength, LOCNAM);
        data.writeUInt16LE(fields.extraLength, LOCEXT);
        
        return data;
    },
    
    LENGTH: LOCHDR
};