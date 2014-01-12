import { fromZipTime, toZipTime } from "Utilities.js";

var CENHDR = 46, // CEN header size
    CENSIG = 0x02014b50, // "PK\001\002"
    CENVEM = 4, // version made by
    CENVER = 6, // version needed to extract
    CENFLG = 8, // encrypt, decrypt flags
    CENHOW = 10, // compression method
    CENTIM = 12, // modification time (2 bytes time, 2 bytes date)
    CENCRC = 16, // uncompressed file crc-32 value
    CENSIZ = 20, // compressed size
    CENLEN = 24, // uncompressed size
    CENNAM = 28, // filename length
    CENEXT = 30, // extra field length
    CENCOM = 32, // file comment length
    CENDSK = 34, // volume number start
    CENATT = 36, // internal file attributes
    CENATX = 38, // external file attributes
    CENOFF = 42; // LOC header offset

export var ZipEntryHeader = {

    fromBuffer(data, offset) {
    
        if (offset)
            data = data.slice(offset);
        
        if (data.length < CENHDR || data.readUInt32LE(0) != CENSIG)
            throw new Error("Invalid CEN header");
    
        return {
            
            versionMadeBy: data.readUInt16LE(CENVEM),
            version: data.readUInt16LE(CENVER),
            flags: data.readUInt16LE(CENFLG),
            method: data.readUInt16LE(CENHOW),
            lastModified: fromZipTime(data.readUInt32LE(CENTIM)),
            crc32: data.readUInt32LE(CENCRC),
            compressedSize: data.readUInt32LE(CENSIZ),
            size: data.readUInt32LE(CENLEN),
            fileNameLength: data.readUInt16LE(CENNAM),
            extraLength: data.readUInt16LE(CENEXT),
            commentLength: data.readUInt16LE(CENCOM),
            startDisk: data.readUInt16LE(CENDSK),
            internalAttributes: data.readUInt16LE(CENATT),
            attributes: data.readUInt32LE(CENATX),
            offset: data.readUInt32LE(CENOFF),
            
            get headerSize() { return CENHDR + this.variableSize; },
            get variableSize() { return this.fileNameLength + this.extraLength + this.commentLength; }
        }
    },
    
    toBuffer(fields) {
    
        var data = new Buffer(
            CENHDR + 
            fields.fileNameLength + 
            fields.extraLength + 
            fields.commentLength);
        
        data.writeUInt32LE(CENSIG, 0);
        data.writeUInt16LE(fields.versionMadeBy, CENVEM);
        data.writeUInt16LE(fields.version, CENVER);
        data.writeUInt16LE(fields.flags, CENFLG);
        data.writeUInt16LE(fields.method, CENHOW);
        data.writeUInt32LE(toZipTime(fields.lastModified), CENTIM);
        data.writeInt32LE(fields.crc32, CENCRC, true);
        data.writeUInt32LE(fields.compressedSize, CENSIZ);
        data.writeUInt32LE(fields.size, CENLEN);
        data.writeUInt16LE(fields.fileNameLength, CENNAM);
        data.writeUInt16LE(fields.extraLength, CENEXT);
        data.writeUInt16LE(fields.commentLength, CENCOM);
        data.writeUInt16LE(fields.startDisk, CENDSK);
        data.writeUInt16LE(fields.internalAttributes, CENATT);
        data.writeUInt32LE(fields.attributes, CENATX);
        data.writeUInt32LE(fields.offset, CENOFF);
        
        return data;
    },
    
    LENGTH: CENHDR
};
