import { Condition, Mutex } from "streamware";

var Z = process.binding("zlib");

var MODES = {

    "inflate": Z.INFLATE,
    "deflate": Z.DEFLATE,
    "inflate-raw": Z.INFLATERAW,
    "deflate-raw": Z.DEFLATERAW,
    "gzip": Z.GZIP,
    "gunzip": Z.GUNZIP
}

function Opt(options = {}) {

    return (name, val) => name in options ? options[name] : val;
}

class ZipStream {

    constructor(mode, options) {

        if (!mode || MODES[mode] === void 0)
            throw new Error("Invalid mode");

        this.output = null;
        this.outputState = "";
        this.error = null;
        this.reading = new Mutex;
        this.writing = new Mutex;
        this.outputReady = new Condition;
        this.outputDone = new Condition;

        var opt = Opt(options);

        this.zlib = new Z.Zlib(MODES[mode]);

        this.zlib.init(
            opt("windowBits", 15),
            opt("compression", Z.Z_DEFAULT_COMPRESSION),
            opt("memoryLevel", 8),
            opt("strategy", Z.Z_DEFAULT_STRATEGY),
            opt("dictionary"));
    }

    async read(buffer) {

        return this.reading.lock(async $=> {

            // Null signals end-of-stream
            if (!this.zlib)
                return null;

            this.output = buffer;

            // Signal that a buffer is ready and wait until buffer is done
            this.outputState = "ready";
            this.outputReady.notify();
            await this.outputDone.wait();

            var b = this.output;
            this.output = null;
            this.outputState = "";

            return b;

        });
    }

    async write(buffer) {

        return await this._write(buffer, false);
    }

    async end() {

        // Write the final, flushing buffer
        return await this._write(new Buffer(0), true);
    }

    async _write(buffer, end) {

        return this.writing.lock(async $=> {

            if (!this.zlib)
                throw new Error("Stream closed");

            var written = 0,
                resolver,
                promise;

            promise = new Promise((resolve, reject) => resolver = { resolve, reject });

            var pump = async (buffer, start, length) => {

                // Wait for a reader
                if (this.outputState !== "ready")
                    await this.outputReady.wait();

                var inOffset = start || 0,
                    inLength = length || (buffer.length - inOffset),
                    outOffset = 0,
                    outLength = this.output.length;

                // Send a write command to zlib
                var req = this.zlib.write(
                    end ? Z.Z_FINISH : Z.Z_NO_FLUSH,
                    buffer,
                    inOffset,
                    inLength,
                    this.output,
                    outOffset,
                    outLength);

                req.output = buffer;

                // When the command has finished...
                req.callback = async (inLeft, outLeft) => {

                    try {

                        written += inLength - inLeft;

                        // Notify reader that output buffer is ready
                        this.output = this.output.slice(0, outLength - outLeft);
                        this.outputState = "done";
                        this.outputDone.notify();

                        if (outLeft === 0) {

                            // If the output buffer was completely used, assume that there
                            // is more data to write
                            await pump(buffer, buffer.length - inLeft);

                        } else {

                            // Write is complete
                            resolver.resolve();
                        }

                    } catch (x) {

                        resolver.reject(x);
                    }
                };
            };

            // Set an error handler specific to this write operation
            this.zlib.onerror = (msg, errno) => {

                resolver.reject(this.error = new Error(msg));

                // End the stream ungracefully
                this.zlib = null;

                // Signal that we are done with the output buffer
                this.output = null;
                this.outputState = "done";
                this.outputDone.notify();
            };

            // Start writing data
            await pump(buffer);

            // Wait for write to complete
            await promise;

            // Clear the error handler
            this.zlib.onerror = undefined;

            // Close zlib if we are ending the stream
            if (end) {

                this.ended = true;
                this.zlib.close();
                this.zlib = null;
            }

            return written;

        });

    }

}

export class DeflateStream extends ZipStream {

    constructor(header, options) { super(header ? "deflate" : "deflate-raw", options) }
}

export class InflateStream extends ZipStream {

    constructor(header, options) { super(header ? "inflate" : "inflate-raw", options) }
}

export class GZipStream extends ZipStream {

    constructor(options) { super("gzip", options) }
}

export class GUnzipStream extends ZipStream {

    constructor(options) { super("gunzip", options) }
}
