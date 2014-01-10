// Returns a normalized path which is valid within an archive
export function normalizePath(path) {

    return path
        .replace(/\\+/g, "/")        // Convert "\" to "/"
        .replace(/\/\/+/g, "/")      // Collapse "//"
        .replace(/^(\w+:)?\//, "")   // Remove absolute prefixes
}

// == CRC-32 Redundancy Checking ==

export class Crc32 {

    constructor(buffer) {
    
        this.crc = ~0;
        
        if (buffer)
            this.accumulate(buffer);
    }
    
    accumulate(buffer) {
    
        var len = buffer.length,
            c = this.crc,
            i;
        
        if (!Crc32.TABLE)
            Crc32.TABLE = Crc32.createTable();
        
        for (i = 0; i < len; ++i)
            c = Crc32.TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
        
        this.crc = c;
    }
    
    get value() {
    
        var crc = ~this.crc;
        
        if (crc < 0) // Reinterpret as unsigned int
            crc = 0xffffffff + crc + 1;
        
        return crc;
    }
    
    static calculate(buffer) { 
    
        return new Crc32(buffer).value;
    }
    
    static createTable() {
    
        var table = [], n, k, c;
    
        for (n = 0; n < 256; n++) {
        
            c = n;
        
            for (k = 8; --k >= 0;)
                c = (c & 1) != 0 ? 0xedb88320 ^ (c >>> 1) : c = c >>> 1;
        
            if (c < 0) // Reinterpret as unsigned int
                c = 0xffffffff + c + 1;
        
            table[n] = c;
        }
    
        return table;
    }
}

// == MS-DOS Date/Time Value Conversions ==

// Returns a Date object for the specified MS-DOS date/time value
export function fromZipTime(num) {
    
    return new Date(
        ((num >> 25) & 0x7f) + 1980,
        ((num >> 21) & 0x0f) - 1,
        (num >> 16) & 0x1f,
        (num >> 11) & 0x1f,
        (num >> 5) & 0x3f,
        (num & 0x1f) << 1
    );
}

// Returns an MS-DOS date/time value for the specified Date object
export function toZipTime(date) {

    return (date.getFullYear() - 1980 & 0x7f) << 25 | 
           (date.getMonth() + 1) << 21 |
           date.getDate() << 16 |
           date.getHours() << 11 |
           date.getMinutes() << 5 |
           date.getSeconds() >> 1;
}
