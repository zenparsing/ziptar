var HAS = Object.prototype.hasOwnProperty,
    SPACE = " ".charCodeAt(0),
    NL = "\n".charCodeAt(0),
    EQ = "=".charCodeAt(0);

var NUMERIC_FIELD = /^(size|uid|gid)$/,
    DATE_FIELD = /^[amc]time$/;

export class TarExtended {
    
    static write(fields) {
    
        return new Buffer(Object.keys(fields).map(k => {
        
            var line = ` ${ k }=${ stringify(fields[k]) }\n`,
                base = Buffer.byteLength(line),
                len = base,
                lenStr;
            
            len = base + (lenStr = len.toString()).length;
            len = base + (lenStr = len.toString()).length;
            
            return len.toString() + line;
            
        }).join(""))
        
        function stringify(value) {
        
            if (value instanceof Date)
                value = value.getTime() / 1000;
            
            return value.toString();
        }
    }
    
    static read(buffer, fields = {}) {
    
        var pos = 0,
            next,
            key,
            val;
        
        while (pos < buffer.length) {
        
            next = pos + readLength();
            tryRead(SPACE);
            
            key = readKey();
            tryRead(EQ);
            
            val = readValue();
            tryRead(NL);
            
            fields[key] = 
                NUMERIC_FIELD.test(key) ? parseFloat(val) : 
                DATE_FIELD.test(key) ? new Date(parseFloat(val) * 1000) :
                val;
        }
        
        return fields;
        
        function readLength() {
        
            var start = pos;
            while (pos < buffer.length && peek() !== SPACE) read();
            return parseInt(buffer.toString("utf8", start, pos).trim(), 10);
        }
        
        function readKey() {
        
            var start = pos;
            while (pos < next && peek() !== EQ) read();
            return buffer.toString("utf8", start, pos);
        }
        
        function readValue() {
        
            var start = pos, last = 0;
            while (pos < next) last = read();
            return buffer.toString("utf8", start, last == NL ? pos - 1 : pos);
        }
        
        function peek() { return buffer[pos] }
        function read() { return buffer[pos++] }
        function tryRead(v) { buffer[pos] == v && ++pos }
    }
    
}

