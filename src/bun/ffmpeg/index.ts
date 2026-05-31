import { dlopen, CString, ptr } from "bun:ffi";
import { join } from "path";
import { readBytes, writePtr, writeInt32, writeInt64 } from "./ffi-helper.ts";
import { renameSync, writeFileSync } from "fs";

const msvcrt = dlopen("C:\\Windows\\System32\\msvcrt.dll", {
  memcpy: { args: ["ptr", "ptr", "usize"], returns: "ptr" },
});
const memcpy = msvcrt.symbols.memcpy;

const NUL = "\x00";

// --- AVCodecID ---
const AV_CODEC_ID_AAC = 86018;

// --- AVSampleFormat ---
const AV_SAMPLE_FMT_S16 = 1;
const AV_SAMPLE_FMT_FLT = 3;
const AV_SAMPLE_FMT_FLTP = 8; // 8 in 8.1.1, not 7!

// --- AVMediaType ---
const AVMEDIA_TYPE_AUDIO = 1;

// --- AV_DISPOSITION ---
const AV_DISPOSITION_ATTACHED_PIC = 0x0400;

// --- Struct field offsets (FFmpeg 6.0 x64) ---
const OFF_STREAMS = 48;
const OFF_NB_STREAMS = 44;
const OFF_DURATION = 104;
const OFF_BITRATE = 112;
const OFF_METADATA = 192;

const OFF_STREAM_CODECPAR = 16;
const OFF_STREAM_DISPOSITION = 64;
const OFF_STREAM_PKT_DATA = 96;

const OFF_CODECPAR_CODEC_TYPE = 0;
const OFF_CODECPAR_CODEC_ID = 4;
const OFF_CODECPAR_FORMAT = 28;
const OFF_CODECPAR_CHANNEL_LAYOUT = 104;
const OFF_CODECPAR_CHANNELS = 112;
const OFF_CODECPAR_SAMPLE_RATE = 116;

const OFF_FRAME_DATA = 0;
const OFF_FRAME_LINESIZE = 64;
const OFF_FRAME_EXTENDED_DATA = 96;
const OFF_FRAME_NB_SAMPLES = 112;
const OFF_FRAME_FORMAT = 116;
const OFF_FRAME_PTS = 136;
const OFF_FRAME_REORDERED_OPAQUE = 160;
const OFF_FRAME_SAMPLE_RATE = 180;
const OFF_FRAME_BUF = 184;

const OFF_ENC_FRAME_SIZE = 376; // AVCodecContext.frame_size
const OFF_BIT_RATE = 336;
const OFF_SAMPLE_RATE = 344;
const OFF_SAMPLE_FMT = 348;
const OFF_CH_LAYOUT = 352;

// --- FFI symbols ---
const avutilSymbols: any = {
  av_dict_set: { args: ["ptr", "ptr", "ptr", "int"], returns: "int" },
  av_dict_iterate: { args: ["ptr", "ptr"], returns: "ptr" },
  av_strerror: { args: ["int", "ptr", "usize"], returns: "int" },
  av_frame_alloc: { returns: "ptr" },
  av_frame_free: { args: ["ptr"], returns: "void" },
  av_frame_clone: { args: ["ptr"], returns: "ptr" },
  av_frame_unref: { args: ["ptr"], returns: "void" },
  av_frame_get_buffer: { args: ["ptr", "int"], returns: "int" },
  av_buffer_unref: { args: ["ptr"], returns: "void" },
  av_samples_alloc: { args: ["ptr", "ptr", "int", "int", "int", "int"], returns: "int" },
  av_freep: { args: ["ptr"], returns: "void" },
  av_malloc: { args: ["usize"], returns: "ptr" },
  av_free: { args: ["ptr"], returns: "void" },
  av_opt_set_int: { args: ["ptr", "ptr", "i64", "int"], returns: "int" },
  av_opt_set_sample_fmt: { args: ["ptr", "ptr", "int", "int"], returns: "int" },
  av_opt_set_chlayout: { args: ["ptr", "ptr", "ptr", "int"], returns: "int" },
};

const avformatSymbols: any = {
  avformat_open_input: { args: ["ptr", "ptr", "ptr", "ptr"], returns: "int" },
  avformat_close_input: { args: ["ptr"], returns: "void" },
  avformat_find_stream_info: { args: ["ptr", "ptr"], returns: "int" },
  avformat_alloc_output_context2: { args: ["ptr", "ptr", "ptr", "ptr"], returns: "int" },
  avformat_free_context: { args: ["ptr"], returns: "void" },
  avformat_new_stream: { args: ["ptr", "ptr"], returns: "ptr" },
  avformat_write_header: { args: ["ptr", "ptr"], returns: "int" },
  av_read_frame: { args: ["ptr", "ptr"], returns: "int" },
  av_interleaved_write_frame: { args: ["ptr", "ptr"], returns: "int" },
  av_write_trailer: { args: ["ptr"], returns: "int" },
  avio_open: { args: ["ptr", "ptr", "int"], returns: "int" },
  avio_close: { args: ["ptr"], returns: "void" },
};

const avcodecSymbols: any = {
  av_packet_alloc: { returns: "ptr" },
  av_packet_free: { args: ["ptr"], returns: "void" },
  av_packet_unref: { args: ["ptr"], returns: "void" },
  av_packet_from_data: { args: ["ptr", "ptr", "int"], returns: "int" },
  avcodec_parameters_copy: { args: ["ptr", "ptr"], returns: "int" },
  avcodec_parameters_to_context: { args: ["ptr", "ptr"], returns: "int" },
  avcodec_parameters_from_context: { args: ["ptr", "ptr"], returns: "int" },
  avcodec_find_decoder: { args: ["int"], returns: "ptr" },
  avcodec_find_encoder_by_name: { args: ["ptr"], returns: "ptr" },
  avcodec_alloc_context3: { args: ["ptr"], returns: "ptr" },
  avcodec_open2: { args: ["ptr", "ptr", "ptr"], returns: "int" },
  avcodec_send_packet: { args: ["ptr", "ptr"], returns: "int" },
  avcodec_receive_frame: { args: ["ptr", "ptr"], returns: "int" },
  avcodec_send_frame: { args: ["ptr", "ptr"], returns: "int" },
  avcodec_receive_packet: { args: ["ptr", "ptr"], returns: "int" },
  avcodec_free_context: { args: ["ptr"], returns: "void" },
};

const swresampleSymbols: any = {
  swr_alloc: { returns: "ptr" },
  swr_init: { args: ["ptr"], returns: "int" },
  swr_convert: { args: ["ptr", "ptr", "int", "ptr", "int"], returns: "int" },
  swr_free: { args: ["ptr"], returns: "void" },
};

export interface AudioMetadata {
  tags: Record<string, string>;
  duration?: number;
  bitrate?: number;
}

export default class FFmpeg {
  private initialized = false;
  private appPath: string;
  private U!: any;
  private F!: any;
  private C!: any;
  private S!: any;

  constructor(appPath: string) {
    this.appPath = appPath;
  }

  init(): void {
    this.U = dlopen(join(this.appPath, "avutil-60.dll"), avutilSymbols).symbols;
    this.F = dlopen(join(this.appPath, "avformat-62.dll"), avformatSymbols).symbols;
    this.C = dlopen(join(this.appPath, "avcodec-62.dll"), avcodecSymbols).symbols;
    this.S = dlopen(join(this.appPath, "swresample-6.dll"), swresampleSymbols).symbols;
    this.initialized = true;
  }

  // --- Error helpers ---

  private errMsg(code: number): string {
    const buf = new Uint8Array(1024);
    this.U.av_strerror(code, ptr(buf), 1024);
    return new CString(ptr(buf)) as unknown as string;
  }

  private checkErr(code: number, label: string): void {
    if (code < 0) throw new Error(`${label}: ${this.errMsg(code)} (code=${code})`);
  }

  private readU64(addr: number, offset: number): bigint {
    const data = readBytes(addr + offset, 8);
    return new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(0, true);
  }

  private readI64(addr: number, offset: number): bigint {
    const data = readBytes(addr + offset, 8);
    return new DataView(data.buffer, data.byteOffset, data.byteLength).getBigInt64(0, true);
  }

  private readI32(addr: number, offset: number): number {
    const data = readBytes(addr + offset, 4);
    return new DataView(data.buffer, data.byteOffset, data.byteLength).getInt32(0, true);
  }

  private makeChannelLayout(mask: number, nbChannels: number): Uint8Array {
    const buf = new Uint8Array(24);
    const dv = new DataView(buf.buffer);
    dv.setInt32(0, 1, true);              // order = AV_CHANNEL_ORDER_NATIVE (1)
    dv.setInt32(4, nbChannels, true);      // nb_channels
    dv.setBigUint64(8, BigInt(mask), true); // mask (uint64_t)
    dv.setBigUint64(16, 0n, true);         // opaque = NULL
    return buf;
  }

  private guessImageExt(bytes: Uint8Array): string {
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "gif";
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return "webp";
    if (bytes[0] === 0x42 && bytes[1] === 0x4d) return "bmp";
    return "jpeg";
  }

  // --- Public API ---

  readMetadata(filePath: string): AudioMetadata {
    if (!this.initialized) this.init();
    const pathBuf = Buffer.from(filePath + NUL, "utf8");
    const ps = new BigUint64Array(1);

    let ret = this.F.avformat_open_input(ptr(ps), ptr(pathBuf), null, null);
    this.checkErr(ret, "avformat_open_input");

    try {
      const fmtCtxPtr = Number(ps[0]);
      ret = this.F.avformat_find_stream_info(fmtCtxPtr, null);
      this.checkErr(ret, "avformat_find_stream_info");

      const metadataPtr = Number(this.readU64(fmtCtxPtr, OFF_METADATA));
      const AV_NOPTS_VALUE = -(2n ** 63n);
      const durationRaw = this.readI64(fmtCtxPtr, OFF_DURATION);
      const bitrateRaw = this.readI64(fmtCtxPtr, OFF_BITRATE);

      let duration: number | undefined;
      let bitrate: number | undefined;
      if (durationRaw !== AV_NOPTS_VALUE && durationRaw > 0n) duration = Number(durationRaw) / 1_000_000;
      if (bitrateRaw > 0n) bitrate = Number(bitrateRaw);

      const tags: Record<string, string> = {};
      if (metadataPtr !== 0) {
        let prev: unknown = null;
        while (true) {
          const entryPtr: unknown = this.U.av_dict_iterate(metadataPtr, prev);
          if (!entryPtr) break;
          const entry = readBytes(entryPtr as number, 16);
          const keyPtr = Number(new DataView(entry.buffer).getBigUint64(0, true));
          const valPtr = Number(new DataView(entry.buffer).getBigUint64(8, true));
          if (keyPtr !== 0 && valPtr !== 0) {
            tags[new CString(keyPtr as any) as unknown as string] = new CString(valPtr as any) as unknown as string;
          }
          prev = entryPtr;
        }
      }

      return { tags, duration, bitrate };
    } finally {
      this.F.avformat_close_input(ptr(ps));
    }
  }

  readThumbnail(filePath: string): string | null {
    if (!this.initialized) this.init();
    const pathBuf = Buffer.from(filePath + NUL, "utf8");
    const ps = new BigUint64Array(1);

    let ret = this.F.avformat_open_input(ptr(ps), ptr(pathBuf), null, null);
    if (ret < 0) throw new Error(`avformat_open_input: ${ret}`);

    try {
      const fmtCtxPtr = Number(ps[0]);
      ret = this.F.avformat_find_stream_info(fmtCtxPtr, null);
      if (ret < 0) throw new Error(`avformat_find_stream_info: ${ret}`);

      const nbStreams = this.readI32(fmtCtxPtr, OFF_NB_STREAMS);
      const streamsPtr = Number(this.readU64(fmtCtxPtr, OFF_STREAMS));

      for (let i = 0; i < nbStreams; i++) {
        const streamPtr = Number(this.readU64(streamsPtr, i * 8));
        if (streamPtr === 0) continue;
        const disposition = this.readI32(streamPtr, OFF_STREAM_DISPOSITION);

        if (disposition & AV_DISPOSITION_ATTACHED_PIC) {
          const dataPtr = Number(this.readU64(streamPtr + OFF_STREAM_PKT_DATA, 24));
          const dataSize = this.readI32(streamPtr + OFF_STREAM_PKT_DATA, 32);
          if (dataPtr !== 0 && dataSize > 0) {
            const imgBytes = readBytes(dataPtr, dataSize);
            const ext = this.guessImageExt(imgBytes);
            const b64 = Buffer.from(imgBytes).toString("base64");
            return `data:image/${ext};base64,${b64}`;
          }
        }
      }
      return null;
    } finally {
      this.F.avformat_close_input(ptr(ps));
    }
  }

  saveThumbnail(filePath: string, outputTxtPath: string): void {
    const dataUri = this.readThumbnail(filePath);
    if (dataUri === null) throw new Error("No attached picture found");
    writeFileSync(outputTxtPath, dataUri, "utf8");
  }

  async embedMetadata(filePath: string, metadata: Record<string, string>, thumbnailDataUri?: string): Promise<void> {
    if (!this.initialized) this.init();

    const pathBuf = Buffer.from(filePath + NUL, "utf8");
    const ext = filePath.includes(".") ? filePath.substring(filePath.lastIndexOf(".")) : "";
    const base = ext ? filePath.substring(0, filePath.lastIndexOf(".")) : filePath;
    const tmpPath = base + ".embed_tmp" + ext;
    const tmpBuf = Buffer.from(tmpPath + NUL, "utf8");
    const ps = new BigUint64Array(1);

    let ret = this.F.avformat_open_input(ptr(ps), ptr(pathBuf), null, null);
    this.checkErr(ret, "avformat_open_input");
    const ifmtCtx = Number(ps[0]);

    let ocPtr = 0;
    let pkt = 0;
    let thumbPkt = 0;
    let opened = false;
    const ioPtrs = new BigUint64Array(1);

    try {
      ret = this.F.avformat_find_stream_info(ifmtCtx, null);
      this.checkErr(ret, "avformat_find_stream_info");

      // --- Create output context ---
      const ocPtrs = new BigUint64Array(1);
      ret = this.F.avformat_alloc_output_context2(ptr(ocPtrs), null, null, ptr(tmpBuf));
      this.checkErr(ret, "avformat_alloc_output_context2");
      ocPtr = Number(ocPtrs[0]);

      // --- Copy input metadata then override ---
      const ocMetaAddr = ocPtr + OFF_METADATA;
      const inMetaPtr = Number(this.readU64(ifmtCtx, OFF_METADATA));
      if (inMetaPtr) {
        let prev: unknown = null;
        while (true) {
          const entryPtr: unknown = this.U.av_dict_iterate(inMetaPtr, prev);
          if (!entryPtr) break;
          const entry = readBytes(entryPtr as number, 16);
          const kp = Number(new DataView(entry.buffer).getBigUint64(0, true));
          const vp = Number(new DataView(entry.buffer).getBigUint64(8, true));
          if (kp !== 0 && vp !== 0) {
            this.U.av_dict_set(ocMetaAddr, ptr(Buffer.from(new CString(kp as any) as unknown as string + NUL, "utf8")), ptr(Buffer.from(new CString(vp as any) as unknown as string + NUL, "utf8")), 0);
          }
          prev = entryPtr;
        }
      }
      for (const [k, v] of Object.entries(metadata)) {
        this.U.av_dict_set(ocMetaAddr, ptr(Buffer.from(k + NUL, "utf8")), ptr(Buffer.from(v + NUL, "utf8")), 0);
      }

      // --- Copy audio streams (stream copy) ---
      const nbStreams = this.readI32(ifmtCtx, OFF_NB_STREAMS);
      const streamsPtr = Number(this.readU64(ifmtCtx, OFF_STREAMS));
      for (let i = 0; i < nbStreams; i++) {
        const isp = Number(this.readU64(streamsPtr, i * 8));
        if (isp === 0) continue;
        const osp = Number(this.F.avformat_new_stream(ocPtr, null));
        if (osp === 0) throw new Error("avformat_new_stream failed");
        ret = this.C.avcodec_parameters_copy(Number(this.readU64(osp, OFF_STREAM_CODECPAR)), Number(this.readU64(isp, OFF_STREAM_CODECPAR)));
        this.checkErr(ret, "avcodec_parameters_copy");
        const tb = readBytes(isp + 32, 8);
        memcpy(osp + 32, ptr(tb), 8);
      }

      // --- Add thumbnail as attached picture stream ---
      if (thumbnailDataUri) {
        const m = thumbnailDataUri.match(/^data:image\/(\w+);base64,(.+)$/);
        if (m) {
          const img = Buffer.from(m[2], "base64");
          const isPng = m[1] === "png";
          const ts = Number(this.F.avformat_new_stream(ocPtr, null));
          if (ts !== 0) {
            writeInt32(ts + OFF_STREAM_DISPOSITION, AV_DISPOSITION_ATTACHED_PIC);
            const cp = Number(this.readU64(ts, OFF_STREAM_CODECPAR));
            writeInt32(cp + OFF_CODECPAR_CODEC_TYPE, 0);
            writeInt32(cp + OFF_CODECPAR_CODEC_ID, isPng ? 61 : 7);
            writeInt32(ts + 32, 1);
            writeInt32(ts + 36, 90000);

            const hd = Number(this.U.av_malloc(img.length));
            if (hd !== 0) {
              memcpy(hd, ptr(img), img.length);
              const tp = this.C.av_packet_alloc();
              const tpNum = Number(tp);
              if (tpNum !== 0) {
                ret = this.C.av_packet_from_data(tp, hd, img.length);
                this.checkErr(ret, "av_packet_from_data");
                const ti = this.readI32(ts, 0);
                writeInt32(tpNum + 36, ti);
                writeInt64(tpNum + 8, 0n);
                writeInt64(tpNum + 16, 0n);
                writeInt32(tpNum + 40, 1);
                thumbPkt = tpNum;
              }
            }
          }
        }
      }

      // --- Open output ---
      ret = this.F.avio_open(ptr(ioPtrs), ptr(tmpBuf), 2);
      this.checkErr(ret, "avio_open");
      opened = true;
      writePtr(ocPtr + 32, ioPtrs[0]!);

      ret = this.F.avformat_write_header(ocPtr, null);
      this.checkErr(ret, "avformat_write_header");

      // --- Write thumbnail packet first ---
      if (thumbPkt !== 0) {
        ret = this.F.av_interleaved_write_frame(ocPtr, thumbPkt);
        if (ret < 0) this.checkErr(ret, "av_interleaved_write_frame");
        thumbPkt = 0;
      }

      // --- Read-copy audio ---
      pkt = Number(this.C.av_packet_alloc());
      if (pkt === 0) throw new Error("av_packet_alloc failed");
      while (true) {
        ret = this.F.av_read_frame(ifmtCtx, pkt);
        if (ret < 0) break;
        ret = this.F.av_interleaved_write_frame(ocPtr, pkt);
        if (ret < 0) this.checkErr(ret, "av_interleaved_write_frame");
      }

      this.F.av_write_trailer(ocPtr);

    } finally {
      if (thumbPkt !== 0) {
        const ref = new BigUint64Array([BigInt(thumbPkt)]);
        this.C.av_packet_free(ptr(ref));
      }
      if (pkt !== 0) {
        const ref = new BigUint64Array([BigInt(pkt)]);
        this.C.av_packet_free(ptr(ref));
      }
      if (opened) try { this.F.avio_close(Number(ioPtrs[0])); } catch { }
      if (ocPtr !== 0) try { this.F.avformat_free_context(ocPtr as any); } catch { }
      try { this.F.avformat_close_input(ptr(ps)); } catch { }
    }

    renameSync(tmpPath, filePath);
  }

  async convertAudio(inputPath: string, outputPath: string): Promise<void> {
    if (!this.initialized) this.init();

    const inputPathBuf = Buffer.from(inputPath + NUL, "utf8");
    const outputPathBuf = Buffer.from(outputPath + NUL, "utf8");
    const ps = new BigUint64Array(1);

    let ret = this.F.avformat_open_input(ptr(ps), ptr(inputPathBuf), null, null);
    this.checkErr(ret, "avformat_open_input");
    const fmtCtxPtr = Number(ps[0]);

    let decoderCtx = 0;
    let encoderCtx = 0;
    let swrCtx = 0;
    let ocPtr = 0;
    let pkt = 0;
    let outPkt = 0;
    let frame = 0;
    let encFrameTemplate = 0;
    let encFrameSize = 1024;
    let ptsCounter = 0;
    let opened = false;
    const ioPtrs = new BigUint64Array(1);

    const cleanups: (() => void)[] = [];

    try {
      ret = this.F.avformat_find_stream_info(fmtCtxPtr, null);
      this.checkErr(ret, "avformat_find_stream_info");

      // --- Find audio stream ---
      const nbStreams = this.readI32(fmtCtxPtr, OFF_NB_STREAMS);
      const streamsPtr = Number(this.readU64(fmtCtxPtr, OFF_STREAMS));

      let audioStreamIdx = -1;
      let codecparPtr = 0;

      for (let i = 0; i < nbStreams; i++) {
        const streamPtr = Number(this.readU64(streamsPtr, i * 8));
        if (streamPtr === 0) continue;
        const cpPtr = Number(this.readU64(streamPtr, OFF_STREAM_CODECPAR));
        if (cpPtr === 0) continue;
        if (this.readI32(cpPtr, OFF_CODECPAR_CODEC_TYPE) === AVMEDIA_TYPE_AUDIO) {
          audioStreamIdx = i;
          codecparPtr = cpPtr;
          break;
        }
      }
      if (audioStreamIdx < 0) throw new Error("No audio stream found");

      const codecId = this.readI32(codecparPtr, OFF_CODECPAR_CODEC_ID);
      let inSampleRate = this.readI32(codecparPtr, OFF_CODECPAR_SAMPLE_RATE);
      let inChannels = this.readI32(codecparPtr, OFF_CODECPAR_CHANNELS);
      let inSampleFmt = this.readI32(codecparPtr, OFF_CODECPAR_FORMAT);
      let inChannelLayout = Number(this.readU64(codecparPtr, OFF_CODECPAR_CHANNEL_LAYOUT));

      if (inSampleRate <= 0) inSampleRate = 44100;
      if (inChannels <= 0) inChannels = 2;
      if (inSampleFmt <= 0) inSampleFmt = AV_SAMPLE_FMT_FLT;
      if (inChannelLayout === 0) inChannelLayout = inChannels === 1 ? 4 : 3;

      // --- Open decoder ---
      const decoder = this.C.avcodec_find_decoder(codecId);
      if (Number(decoder) === 0) throw new Error("avcodec_find_decoder failed");

      decoderCtx = Number(this.C.avcodec_alloc_context3(decoder));
      if (decoderCtx === 0) throw new Error("avcodec_alloc_context3 failed");
      cleanups.push(() => {
        const ref = new BigUint64Array([BigInt(decoderCtx)]);
        this.C.avcodec_free_context(ptr(ref));
      });

      ret = this.C.avcodec_parameters_to_context(decoderCtx, codecparPtr);
      this.checkErr(ret, "avcodec_parameters_to_context");

      ret = this.C.avcodec_open2(decoderCtx, decoder, null);
      this.checkErr(ret, "avcodec_open2");

      // Read params from decoder context (uses verified AVCodecContext offsets for 8.1.1)
      inSampleRate = this.readI32(decoderCtx, OFF_SAMPLE_RATE);
      inSampleFmt = this.readI32(decoderCtx, OFF_SAMPLE_FMT);
      inChannels = this.readI32(decoderCtx, OFF_CH_LAYOUT + 4);
      inChannelLayout = Number(this.readU64(decoderCtx, OFF_CH_LAYOUT + 8));
      if (inSampleRate <= 0) inSampleRate = 44100;
      if (inChannels <= 0) inChannels = 2;
      if (inSampleFmt <= 0) inSampleFmt = AV_SAMPLE_FMT_FLT;
      if (inChannelLayout === 0) inChannelLayout = inChannels === 1 ? 4 : 3;
      console.log("Decoder params:", inSampleRate, inSampleFmt, inChannels, inChannelLayout.toString(16));
      inSampleRate = this.readI32(decoderCtx, OFF_SAMPLE_RATE);
      inChannels = this.readI32(decoderCtx, OFF_CH_LAYOUT + 4);
      inSampleFmt = this.readI32(decoderCtx, OFF_SAMPLE_FMT);
      inChannelLayout = Number(this.readU64(decoderCtx, OFF_CH_LAYOUT + 8));
      if (inSampleRate <= 0) inSampleRate = 44100;
      if (inChannels <= 0) inChannels = 2;
      if (inSampleFmt <= 0) inSampleFmt = AV_SAMPLE_FMT_FLT;
      if (inChannelLayout === 0) inChannelLayout = inChannels === 1 ? 4 : 3;

      // --- Create output format context ---
      const ocPtrs = new BigUint64Array(1);
      const fmtName = Buffer.from("mp4\0", "utf8");
      ret = this.F.avformat_alloc_output_context2(ptr(ocPtrs), null, ptr(fmtName), ptr(outputPathBuf));
      this.checkErr(ret, "avformat_alloc_output_context2");
      ocPtr = Number(ocPtrs[0]);
      cleanups.push(() => { this.F.avformat_free_context(ocPtr as any); });

      // --- Open AAC encoder ---
      const encoderName = Buffer.from("aac\0", "utf8");
      const encoder = this.C.avcodec_find_encoder_by_name(ptr(encoderName));
      if (Number(encoder) === 0) throw new Error("AAC encoder not found");

      encoderCtx = Number(this.C.avcodec_alloc_context3(encoder));
      if (encoderCtx === 0) throw new Error("avcodec_alloc_context3 failed");
      cleanups.push(() => {
        const ref = new BigUint64Array([BigInt(encoderCtx)]);
        this.C.avcodec_free_context(ptr(ref));
      });

      // Set AVCodecContext fields directly (cstring/av_opt_set_* broken in bun 1.3.14)
      writeInt32(encoderCtx + OFF_SAMPLE_RATE, inSampleRate);
      writeInt32(encoderCtx + OFF_SAMPLE_FMT, AV_SAMPLE_FMT_FLTP);
      writeInt32(encoderCtx + OFF_CH_LAYOUT, 1);
      writeInt32(encoderCtx + OFF_CH_LAYOUT + 4, inChannels);
      writeInt64(encoderCtx + OFF_CH_LAYOUT + 8, BigInt(inChannelLayout));
      writeInt64(encoderCtx + OFF_CH_LAYOUT + 16, 0n);
      writeInt64(encoderCtx + OFF_BIT_RATE, 192000n);

      const encOpts = new BigUint64Array(1);
      this.U.av_dict_set(ptr(encOpts), ptr(Buffer.from("b\0", "utf8")), ptr(Buffer.from("192000\0", "utf8")), 0);

      ret = this.C.avcodec_open2(encoderCtx, encoder, ptr(encOpts));
      this.checkErr(ret, "avcodec_open2");

      // --- Create output stream ---
      const outStreamPtr = Number(this.F.avformat_new_stream(ocPtr, null));
      if (outStreamPtr === 0) throw new Error("avformat_new_stream failed");

      const outCodecparPtr = Number(this.readU64(outStreamPtr, OFF_STREAM_CODECPAR));
      ret = this.C.avcodec_parameters_from_context(outCodecparPtr, encoderCtx);
      this.checkErr(ret, "avcodec_parameters_from_context");

      // --- Set up resampler ---
      const outSampleFmt = AV_SAMPLE_FMT_FLTP;
      const outSampleRate = inSampleRate;
      const outChannels = inChannels;

      swrCtx = Number(this.S.swr_alloc());
      if (swrCtx === 0) throw new Error("swr_alloc failed");
      cleanups.push(() => { this.S.swr_free(ptr(new BigUint64Array([BigInt(swrCtx)]))); });

      ret = this.U.av_opt_set_int(swrCtx, ptr(Buffer.from("in_sample_rate\0", "utf8")), inSampleRate, 0);
      this.checkErr(ret, "av_opt_set_int(in_sample_rate)");
      ret = this.U.av_opt_set_sample_fmt(swrCtx, ptr(Buffer.from("in_sample_fmt\0", "utf8")), inSampleFmt, 0);
      this.checkErr(ret, "av_opt_set_sample_fmt(in_sample_fmt)");
      const inChLayout = this.makeChannelLayout(inChannelLayout, inChannels);
      ret = this.U.av_opt_set_chlayout(swrCtx, ptr(Buffer.from("in_chlayout\0", "utf8")), ptr(inChLayout), 0);
      this.checkErr(ret, "av_opt_set_chlayout(in_chlayout)");

      ret = this.U.av_opt_set_int(swrCtx, ptr(Buffer.from("out_sample_rate\0", "utf8")), outSampleRate, 0);
      this.checkErr(ret, "av_opt_set_int(out_sample_rate)");
      ret = this.U.av_opt_set_sample_fmt(swrCtx, ptr(Buffer.from("out_sample_fmt\0", "utf8")), outSampleFmt, 0);
      this.checkErr(ret, "av_opt_set_sample_fmt(out_sample_fmt)");
      const outChLayout = this.makeChannelLayout(inChannelLayout, outChannels);
      ret = this.U.av_opt_set_chlayout(swrCtx, ptr(Buffer.from("out_chlayout\0", "utf8")), ptr(outChLayout), 0);
      this.checkErr(ret, "av_opt_set_chlayout(out_chlayout)");

      ret = this.S.swr_init(swrCtx);
      this.checkErr(ret, "swr_init");

      // --- Open output file ---
      ret = this.F.avio_open(ptr(ioPtrs), ptr(outputPathBuf), 2);
      this.checkErr(ret, "avio_open");
      opened = true;

      writePtr(ocPtr + 32, ioPtrs[0]!);

      ret = this.F.avformat_write_header(ocPtr, null);
      this.checkErr(ret, "avformat_write_header");

      // --- Allocate packets and frame ---
      pkt = Number(this.C.av_packet_alloc());
      if (pkt === 0) throw new Error("av_packet_alloc failed");
      cleanups.push(() => {
        const ref = new BigUint64Array([BigInt(pkt)]);
        this.C.av_packet_free(ptr(ref));
      });

      outPkt = Number(this.C.av_packet_alloc());
      if (outPkt === 0) throw new Error("av_packet_alloc failed");
      cleanups.push(() => {
        const ref = new BigUint64Array([BigInt(outPkt)]);
        this.C.av_packet_free(ptr(ref));
      });

      frame = Number(this.U.av_frame_alloc());
      if (frame === 0) throw new Error("av_frame_alloc failed");
      cleanups.push(() => this.U.av_frame_free(ptr(new BigUint64Array([BigInt(frame)]))));

      // --- Read-decode-resample-encode loop ---
      let hadFrames = false;

      while (true) {
        ret = this.F.av_read_frame(fmtCtxPtr, pkt);
        if (ret < 0) break;

        if (this.readI32(pkt, 8) === audioStreamIdx) {
          ret = this.C.avcodec_send_packet(decoderCtx, pkt);
          this.C.av_packet_unref(pkt);
          if (ret < 0) continue;

          while (true) {
            ret = this.C.avcodec_receive_frame(decoderCtx, frame);
            if (ret < 0) break;
            hadFrames = true;

            const nbInSamples = this.readI32(frame, OFF_FRAME_NB_SAMPLES);
            if (nbInSamples <= 0) continue;

            // Build input pointer array from frame data
            const inPtrArr = new BigUint64Array(inChannels);
            for (let c = 0; c < inChannels; c++) {
              inPtrArr[c] = this.readU64(frame, OFF_FRAME_DATA + c * 8);
            }

            // Allocate output buffers for resampled audio (FLTP = 4 bytes per sample)
            const maxOutSamples = Math.ceil(nbInSamples * 1.5) + 256;
            const outBufs: Uint8Array[] = [];
            const outPtrArr = new BigUint64Array(outChannels);
            for (let c = 0; c < outChannels; c++) {
              const buf = new Uint8Array(maxOutSamples * 4);
              outBufs.push(buf);
              outPtrArr[c] = BigInt(Number(ptr(buf)));
            }

            const convertedSamples = this.S.swr_convert(swrCtx, ptr(outPtrArr), maxOutSamples, ptr(inPtrArr), nbInSamples);
            if (convertedSamples < 0) break;

            if (convertedSamples > 0) {
              // On first frame, create reusable template from decoder frame
              if (encFrameTemplate === 0) {
                encFrameTemplate = Number(this.U.av_frame_clone(frame));
                if (encFrameTemplate === 0) throw new Error("av_frame_clone failed");
                for (let off = OFF_FRAME_BUF; off < OFF_FRAME_BUF + 4 * 8; off += 8) {
                  const bp = this.readU64(encFrameTemplate, off);
                  if (bp !== 0n) this.U.av_buffer_unref(encFrameTemplate + off);
                }
                encFrameSize = this.readI32(encoderCtx, OFF_ENC_FRAME_SIZE);
                if (encFrameSize <= 0) encFrameSize = 1024;
              }

              let off = 0;
              while (off < convertedSamples) {
                const chunk = Math.min(encFrameSize, convertedSamples - off);
                const ef = Number(this.U.av_frame_clone(encFrameTemplate));
                if (ef === 0) throw new Error("av_frame_clone failed");

                for (let c = 0; c < outChannels; c++) {
                  writePtr(ef + OFF_FRAME_DATA + c * 8, BigInt(Number(ptr(outBufs[c])) + off * 4));
                  writeInt32(ef + OFF_FRAME_LINESIZE + c * 4, chunk * 4);
                }

                const extData = Number(this.readU64(ef, OFF_FRAME_EXTENDED_DATA));
                if (extData !== 0) {
                  for (let c = 0; c < outChannels; c++) {
                    writePtr(extData + c * 8, BigInt(Number(ptr(outBufs[c])) + off * 4));
                  }
                }

                writeInt32(ef + OFF_FRAME_NB_SAMPLES, chunk);
                writeInt32(ef + OFF_FRAME_FORMAT, outSampleFmt);
                writeInt32(ef + OFF_FRAME_SAMPLE_RATE, outSampleRate);
                writeInt64(ef + OFF_FRAME_PTS, BigInt(ptsCounter++));

                ret = this.C.avcodec_send_frame(encoderCtx, ef);
                this.U.av_frame_free(ptr(new BigUint64Array([BigInt(ef)])));
                if (ret < 0) break;

                while (true) {
                  ret = this.C.avcodec_receive_packet(encoderCtx, outPkt);
                  if (ret < 0) break;
                  this.F.av_interleaved_write_frame(ocPtr, outPkt);
                  this.C.av_packet_unref(outPkt);
                }

                off += chunk;
              }
              if (ret < 0) break;
            }
          }
        } else {
          this.C.av_packet_unref(pkt);
        }
      }

      if (!hadFrames) throw new Error("No frames decoded");

      // --- Flush decoder ---
      this.C.avcodec_send_packet(decoderCtx, null);
      while (true) {
        ret = this.C.avcodec_receive_frame(decoderCtx, frame);
        if (ret < 0) break;

        const nbInSamples = this.readI32(frame, OFF_FRAME_NB_SAMPLES);
        if (nbInSamples <= 0) continue;

        const inPtrArr = new BigUint64Array(inChannels);
        for (let c = 0; c < inChannels; c++) {
          inPtrArr[c] = this.readU64(frame, OFF_FRAME_DATA + c * 8);
        }

        const maxOutSamples = 8192;
        const outBufs: Uint8Array[] = [];
        const outPtrArr = new BigUint64Array(outChannels);
        for (let c = 0; c < outChannels; c++) {
          const buf = new Uint8Array(maxOutSamples * 4);
          outBufs.push(buf);
          outPtrArr[c] = BigInt(Number(ptr(buf)));
        }

        const convertedSamples = this.S.swr_convert(swrCtx, ptr(outPtrArr), maxOutSamples, ptr(inPtrArr), nbInSamples);
        if (convertedSamples > 0) {
          let off = 0;
          while (off < convertedSamples) {
            const chunk = Math.min(encFrameSize, convertedSamples - off);
            const ef = Number(this.U.av_frame_clone(encFrameTemplate));
            if (ef === 0) { ret = -1; break; }

            for (let c = 0; c < outChannels; c++) {
              writePtr(ef + OFF_FRAME_DATA + c * 8, BigInt(Number(ptr(outBufs[c])) + off * 4));
              writeInt32(ef + OFF_FRAME_LINESIZE + c * 4, chunk * 4);
            }

            const extData = Number(this.readU64(ef, OFF_FRAME_EXTENDED_DATA));
            if (extData !== 0) {
              for (let c = 0; c < outChannels; c++) {
                writePtr(extData + c * 8, BigInt(Number(ptr(outBufs[c])) + off * 4));
              }
            }

            writeInt32(ef + OFF_FRAME_NB_SAMPLES, chunk);
            writeInt32(ef + OFF_FRAME_FORMAT, outSampleFmt);
            writeInt32(ef + OFF_FRAME_SAMPLE_RATE, outSampleRate);
            writeInt64(ef + OFF_FRAME_PTS, BigInt(ptsCounter++));

            this.C.avcodec_send_frame(encoderCtx, ef);
            this.U.av_frame_free(ptr(new BigUint64Array([BigInt(ef)])));

            while (true) {
              ret = this.C.avcodec_receive_packet(encoderCtx, outPkt);
              if (ret < 0) break;
              this.F.av_interleaved_write_frame(ocPtr, outPkt);
              this.C.av_packet_unref(outPkt);
            }

            off += chunk;
          }
        }
      }

      // --- Flush encoder ---
      this.C.avcodec_send_frame(encoderCtx, null);
      while (true) {
        ret = this.C.avcodec_receive_packet(encoderCtx, outPkt);
        if (ret < 0) break;
        this.F.av_interleaved_write_frame(ocPtr, outPkt);
        this.C.av_packet_unref(outPkt);
      }

      // --- Write trailer ---
      this.F.av_write_trailer(ocPtr);

    } finally {
      // --- Cleanup in reverse order ---
      // Avoid double-free of codec contexts by running our own cleanup first
      // then the format context cleanup at the end
      for (let i = cleanups.length - 1; i >= 0; i--) {
        try { cleanups[i](); } catch { /* ignore cleanup errors */ }
      }
      if (opened) {
        try { this.F.avio_close(Number(ioPtrs[0])); } catch { /* ignore */ }
      }
      try { this.F.avformat_close_input(ptr(ps)); } catch { /* ignore */ }
    }
  }
}
