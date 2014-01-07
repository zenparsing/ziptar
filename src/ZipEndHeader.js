var ENDHDR = 22, // END header size
    ENDSIG = 0x06054b50, // "PK\005\006"
    ENDSUB = 8, // number of entries on this disk
    ENDTOT = 10, // total number of entries
    ENDSIZ = 12, // central directory size in bytes
    ENDOFF = 16, // offset of first CEN header
    ENDCOM = 20; // zip file comment length
    
export var ZipEndHeader = {

    fromBuffer(data, offset) {
    
        if (offset)
            data = data.slice(offset);
        
        if (data.length < ENDHDR || data.readUInt32LE(0) != ENDSIG)
            throw new Error("Invalid END header");

        return {
        
            volumeEntries: data.readUInt16LE(ENDSUB),
            totalEntries: data.readUInt16LE(ENDTOT),
            size: data.readUInt32LE(ENDSIZ),
            offset: data.readUInt32LE(ENDOFF),
            commentLength: data.readUInt16LE(ENDCOM),
            
            get headerSize() { return EndHeader.LENGTH + this.commentLength; },
            get variableSize() { return this.commentLength; }
        };
    },
    
    toBuffer(fields) {
    
        var data = new Buffer(ENDHDR + fields.commentLength);
        
        data.writeUInt32LE(ENDSIG, 0);
        data.writeUInt32LE(0, 4);
        
        data.writeUInt16LE(fields.volumeEntries, ENDSUB);
        data.writeUInt16LE(fields.totalEntries, ENDTOT);
        data.writeUInt32LE(fields.size, ENDSIZ);
        data.writeUInt32LE(fields.offset, ENDOFF);
        data.writeUInt16LE(fields.commentLength, ENDCOM);
        
        return data;
    },
    
    LENGTH: ENDHDR,
    
    SIGNATURE: ENDSIG
};
