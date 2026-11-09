export class RingLog {
  constructor(size, sink) {
    this.buf = new Array(size).fill(null);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
    this.sink = sink;
  }

  write(line) {
    if (this.count === this.buf.length) {
      this.flush(1);
    }
    this.buf[this.tail] = line;
    this.tail = (this.tail + 1) % this.buf.length;
    this.count++;
  }

  flush(n = this.count) {
    for (let k = 0; k < n && this.count > 0; k++) {
      this.sink(this.buf[this.head]);
      this.buf[this.head] = null;
      this.head = (this.head + 1) % this.buf.length;
      this.count--;
    }
  }
}
