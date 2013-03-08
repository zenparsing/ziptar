var EXTSIG = 0x08074b50, // "PK\007\008"
    EXTHDR = 16, // EXT header size
    EXTCRC = 4, // uncompressed file crc-32 value
    EXTSIZ = 8, // compressed size
    EXTLEN = 12; // uncompressed size

export var DataDescriptor = {

    fromBuffer(data, offset) {
    
        if (offset)
            data = data.slice(offset);
        
        if (data.length < EXTHDR || data.readUInt32LE(0) != EXTSIG)
            throw new Error("Invalid EXT header.");
        
        return {
        
            crc32: data.readUInt32LE(EXTCRC),
            compressedSize: data.readUInt32LE(EXTSIZ),
            size: data.readUInt32LE(EXTLEN),
            
            headerSize: EXTHDR,
            variableSize: 0
        };
    },
    
    toBuffer(fields) {
    
        var data = new Buffer(EXTHDR);
        
        data.writeUInt32LE(EXTSIG, 0);
        data.writeUInt32LE(fields.crc32, EXTCRC);
        data.writeUInt32LE(fields.compressedSize, EXTSIZ);
        data.writeUInt32LE(fields.size, EXTLEN);
        
        return data;
    },
    
    LENGTH: EXTHDR
};
