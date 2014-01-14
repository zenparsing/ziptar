var HAS = Object.prototype.hasOwnProperty,
    SPACE = " ".charCodeAt(0),
    NL = "\n".charCodeAt(0),
    EQ = "=".charCodeAt(0);

export class TarExtended {
    
    static write(fields) {
    
        return new Buffer(Object.keys(fields).map(k => {
        
            var line = ` ${ k }=${ fields[k].toString() }\n`,
                base = Buffer.byteLength(line),
                len = base,
                lenStr;
            
            len = base + (lenStr = len.toString()).length;
            len = base + (lenStr = len.toString()).length;
            
            return len.toString() + line;
            
        }).join(""))
    }
    
    static read(buffer) {
    
        var fields = {},
            pos = 0,
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
            
            fields[key] = val;
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
            return buffer.toString("utf8", start, last === NL ? pos - 1 : pos);
        }
        
        function peek() { return buffer[pos] }
        function read() { return buffer[pos++] }
        function tryRead(v) { peek() === v && read() }
    }
    
}
