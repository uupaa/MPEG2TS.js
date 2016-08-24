(function moduleExporter(name, closure) {
"use strict";

var entity = GLOBAL["WebModule"]["exports"](name, closure);

if (typeof module !== "undefined") {
    module["exports"] = entity;
}
return entity;

})("MPEG2TS", function moduleClosure(global, WebModule, VERIFY, VERBOSE) {
"use strict";

// --- technical terms / data structure --------------------
// --- dependency modules ----------------------------------
var Bit             = WebModule["Bit"];
var HexDump         = WebModule["HexDump"];
var MPEG2TSDemuxer  = WebModule["MPEG2TSDemuxer"];
var MPEG2TSNALUnit  = WebModule["MPEG2TSNALUnit"];
// --- import / local extract functions --------------------
var _split8  = Bit["split8"];  // Bit.split8(u32:UINT32, bitPattern:UINT8Array|Uint8Array):UINT32Array
var _split16 = Bit["split16"]; // Bit.split16(u32:UINT32, bitPattern:UINT8Array|Uint8Array):UINT32Array
var _split24 = Bit["split24"]; // Bit.split24(u32:UINT32, bitPattern:UINT8Array|Uint8Array):UINT32Array
var _split32 = Bit["split32"]; // Bit.split32(u32:UINT32, bitPattern:UINT8Array|Uint8Array):UINT32Array
// --- define / local variables ----------------------------
// --- class / interfaces ----------------------------------
var MPEG2TS = {
    "VERBOSE":      VERBOSE,
    "demux":        MPEG2TSDemuxer["demux"],     // MPEG2TS.demux(source:Uint8Array, cursor:UINT32 = 0):MPEG2TSPacketObject
    "toByteStream": MPEG2TS_toByteStream,         // MPEG2TS.toByteStream(tsPackets:MPEG2TSPacketUint8ArrayArray):ByteStreamUint8Array
    "toNALUnit":    MPEG2TS_toNALUnit,            // MPEG2TS.toNALUnit(tsPackets:MPEG2TSPacketUint8ArrayArray):NALUnitObjectArray - [ NALUnitObject, ... ]
    "repository":   "https://github.com/uupaa/MPEG2TS.js",
};

// --- implements ------------------------------------------
function MPEG2TS_toByteStream(packets) { // @arg MPEG2TSPacketUint8ArrayArray - [PAT, PMT, VIDEO_TS_PACKET, ...]
                                         // @ret ByteStreamUint8Array
                                         // @desc convert MPEG2TSPacket to Annex B ByteStream
  //    FileLoader.toArrayBuffer(url, function(buffer) {
  //        var mpeg2ts         = MPEG2TS.demux( new Uint8Array(buffer) );
  //        var videoNALUnit    = MPEG2TS.toNALUnit( mpeg2ts["VIDEO_TS_PACKET"] );
  //    });

    // TSPacket -> PESPacket -> ByteStream
    var pes = _convertTSPacketToPESPacket(packets); // PESPacketObjectArray - [{ PTS, DTS, PAYLOAD }, ...]
    var byteStream = _convertPESPacketToByteStream(pes);

    return byteStream;
}

function MPEG2TS_toNALUnit(packets) { // @arg MPEG2TSPacketUint8ArrayArray - [PAT, PMT, VIDEO_TS_PACKET, ...]
                                      // @ret NALUnitObjectArray - [{ DTS, PTS, NALUnit }, ... ]
                                      // @desc MPEG2TSPacket -> PESPacket -> ByteStream -> NALUnit
    var pes = _convertTSPacketToPESPacket(packets); // PESPacketObjectArray - [{ DTS, PTS, PAYLOAD }, ...]

    return MPEG2TSNALUnit["toNALUnit"](pes);
}

function _convertTSPacketToPESPacket(packet) { // @arg MPEG2TSPacketUint8ArrayArray - [PAT, PMT, VIDEO_TS_PACKET, ...]
                                               // @ret MPEG2TSPESPacketObjectArray - [{ DTS, PTS, PAYLOAD }, ...]
                                               // @desc convert MPEG2TSPacket to MPEG2TSPESPacket
    // [1] 分断化された状態で格納されている TSPacket を結合します
    // [2] 結合した MPEG2TS をパースし、PESPacket を取り出します
    var result = [];

    for (var i = 0, iz = packet.length; i < iz; ++i) {
        // --- [1] concat MPEG2TSPackets ---
        var buffer = new Uint8Array( _getPESPacketBufferLength(packet[i]) );
        var cursor = 0;
        for (var j = 0, jz = packet[i].length; j < jz; ++j) {
            buffer.set(packet[i][j], cursor); // copy buffer
            cursor += packet[i][j].length;
        }
        // --- [2] parse MPEG2TSPacket and create MPEG2PESPacket ---
        // PESPacket = { DTS, PTS, PAYLOAD, ... }
        var PESPacket = _parseMPEG2PESPacket({ source: buffer, cursor: 0 });

        result.push( PESPacket );
    }
    return result;
}

function _getPESPacketBufferLength(packet) {
    var totalBufferLength = 0;
    for (var i = 0, iz = packet.length; i < iz; ++i) {
        totalBufferLength += packet[i].length;
    }
    return totalBufferLength;
}

function _parseMPEG2PESPacket(subview) { // @arg Object - subview, MPEG2-TS Audio/Video byte stream.
                                         // @ret Object - MPEG2 PES Packet object. { DTS, PTS, PAYLOAD, ... }
                                         // @see https://github.com/uupaa/AVC.js/wiki/MPEG2TS#pes-packet
    if (MPEG2TS["VERBOSE"]) {
        HexDump(subview.source, {
            "title": "_parseMPEG2PESPacket",
            "rule": {
                "packet_start_code_prefix(00 00 01)": { "values": [0x00, 0x00, 0x01], "style": "font-weight:bold;color:green" },
                "stream_id(1 byte)":                  { "begin": 3, "end": 4, "style": "font-weight:bold;color:blue" },
                "PES_packet_length(2 byte)":          { "begin": 4, "end": 6, "style": "font-weight:bold;color:red" },
            }
        });
    }

    var packet_start_code_prefix = _read3(subview); // | 24 bits | 00 00 01
    var stream_id                = _read1(subview); // |  8 bits | https://github.com/uupaa/AVC.js/wiki/MPEG2TS#stream_id
    var PES_packet_length        = _read2(subview); // | 16 bits | https://github.com/uupaa/AVC.js/wiki/MPEG2TS#pes_packet_length
    var payload                  = null;
    var videoStream              = _isVideoStream(stream_id); // Boolean
    var audioStream              = _isAudioStream(stream_id); // Boolean

//{@dev
    if (VERIFY) {
        if (packet_start_code_prefix !== 0x000001) {
            throw new TypeError("INVALID PES PACKET FORMAT: " + packet_start_code_prefix);
        }
    }
//}@dev

    // PES_packet_length = 0 は以下のように扱う
    //
    // http://sourcecodebrowser.com/dvbsnoop/1.4.50/pespacket_8c.html の decodePS_PES_packet を見ると
    //  PES_packet_length = 0 で video stream の場合は、unbound video elementary stream らしい
    //  つまり、このパケット単体では完結しないパケットのようだ
    //  PES_packet_length = 0 の場合は、ヘッダ部分を読み込み、パケットの長さは view.source.length から取得すると良いようだ
    //
    // また http://linuxtv.org/pipermail/linux-dvb/2008-August/thread.html#27991 から始まるスレッドにも情報がある
    if (videoStream && PES_packet_length === 0) {
        if (MPEG2TS["VERBOSE"]) {
            console.info("videoStream and PES_packet_length = 0");
        }
        PES_packet_length = subview.source.length;
    }

    if (_isPaddingStream(stream_id)) {
        // skip padding bytes
        if (MPEG2TS["VERBOSE"]) {
            console.log("has padding_stream");
        }
    } else if (_isPayload(stream_id)) {
        payload = subview.source.subarray(subview.cursor, subview.cursor + PES_packet_length);
    } else if (_isHeader(stream_id)) {
        //  |00112345|66789abc|    bit index field
        //  |~~               | -> 2   0     marker_bits '10'
        //  |  ~~             | -> 2   1     PES_scrambling_control `00`
        //  |    ~            | -> 1   2     PES_priority
        //  |     ~           | -> 1   3     data_alignment_indicator
        //  |      ~          | -> 1   4     copyright
        //  |       ~         | -> 1   5     original_or_copy
        //  |         ~~      | -> 2   6     PTS_DTS_flags
        //  |           ~     | -> 1   7     ESCR_flag
        //  |            ~    | -> 1   8     ES_rate_flag
        //  |             ~   | -> 1   9     DSM_trick_mode_flag
        //  |              ~  | -> 1   a     additional_copy_info_flag
        //  |               ~ | -> 1   b     PES_CRC_flag
        //  |                ~| -> 1   c     PES_extension_flag
        var field1                    = _split16(_read2(subview), [2, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1]);
        var filler1                   = field1[0];     // `10` marker_bits
//      var PES_scrambling_control    = field1[1];     // `00`
//      var PES_priority              = field1[2];     // `0`
//      var data_alignment_indicator  = field1[3];     // `?`
//      var copyright                 = field1[4];     // `0`
//      var original_or_copy          = field1[5];     // `0`
//      var PTS_DTS_flags             = field1[6];     // `11` or `10` or `00`
//      var ESCR_flag                 = field1[7];     // `0`
//      var ES_rate_flag              = field1[8];     // `0`
//      var DSM_trick_mode_flag       = field1[9];     // `0`
//      var additional_copy_info_flag = field1[10];    // `0`
//      var PES_CRC_flag              = field1[11];    // `0`
//      var PES_extension_flag        = field1[12];    // `0`
        var PES_header_data_length    = _read1(subview);
        var PES_header_data_end       = subview.cursor + PES_header_data_length;
        var PTS = -1; // presentation time stamp
        var DTS = -1; // decoding time stamp
        var ESCR = null;
//{@dev
        if (VERIFY) {
            if (filler1 !== 2) { throw new TypeError("BAD FORMAT filler1: " + filler1); }
        }
//}@dev

        switch (field1[6]) { // PTS_DTS_flags
        case 0x2: // has PTS
            PTS = _readTimeStamp33bit(subview).time; // +5byte (33bit) 90kHz
            break;
        case 0x3: // has PTS and DTS
            PTS = _readTimeStamp33bit(subview).time; // +5byte (33bit) 90kHz
            DTS = _readTimeStamp33bit(subview).time; // +5byte (33bit) 90kHz
            break;
        }
        if (field1[7]) { // ESCR_flag, ESCR: Elementary Stream Clock Reference
            ESCR     = _readTimeStampESCR(subview);  // +6byte
        }
        if (field1[8]) { // ES_rate_flag
            //  |01111111|11111111|11111112|    bit index field
            //  |~                           -> 1   0     marker_bit
            //  | ~~~~~~~ ~~~~~~~~ ~~~~~~~   -> 22  1     ES_rate
            //  |                         ~  -> 1   2     marker_bit
            //ES_rate = _split24(_read3(subview), [1, 22, 1])[1];
            subview.cursour += 3;
        }
        if (field1[9]) { // DSM_trick_mode_flag
            //_read1(subview); // [3, 2, 1, 2] or [3, 5]
            subview.cursour += 1;
        }
        if (field1[10]) { // additional_copy_info_flag
            //additional_copy_info = _split8(_read1(subview), [1, 7])[1];
            subview.cursour += 1;
        }
        if (field1[11]) { // PES_CRC_flag
            //previous_PES_packet_CRC = _read2(subview);
            subview.cursour += 2;
        }

        var PES_private_data = null;
        if (field1[12]) { // PES_extension_flag
            //
            // |01234445|          bit index field
            //  ~               -> 1   0     PES_private_data_flag
            //   ~              -> 1   1     pack_header_field_flag
            //    ~             -> 1   2     program_packet_sequence_counter_flag
            //     ~            -> 1   3     P-STD_buffer_flag
            //      ~~~         -> 3   4     Reserved
            //         ~        -> 1   5     PES_extension_flag_2
            var field2 = _split8(_read1(subview), [1, 1, 1, 1, 3, 1]);

            if (field2[0]) { // PES_private_data_flag
                PES_private_data = new Uint8Array(subview.source.subarray(subview.cursor, subview.cursor + 128));
                subview.cursor += 128;
            }
            if (field2[1]) { // pack_header_field_flag
                var pack_field_length = _read1(subview);
                //pack_header();
                subview.cursor += pack_field_length;
            }
            if (field2[2]) { // program_packet_sequence_counter_flag
                //_read2(subview);
                subview.cursor += 2;
            }
            if (field2[3]) { // P-STD_buffer_flag
                //_read2(subview);
                subview.cursor += 2;
            }
            if (field2[5]) { // PES_extension_flag_2
                var PES_extension_field_length = _split8(_read1(subview), [1, 7])[1];
                var field4 = _split8(_read1(subview), [1, 7]); // [stream_id_extension_flag, stream_id_extension]
                if (field4[0] === 0x0) {
                    for (var i = 0, iz = PES_extension_field_length; i < iz; ++i) {
                        _read1(subview); // skip
                    }
                }
            }
        }
        subview.cursor = PES_header_data_end; // skip stuffing_byte

        payload = subview.source.subarray(subview.cursor, subview.cursor + PES_packet_length);
    }

    if (MPEG2TS["VERBOSE"]) {
        // HexDump(payload);
        if (videoStream) { console.log("VideoStream payload: " + payload.length + " bytes"); }
        if (audioStream) { console.log("AudioStream payload: " + payload.length + " bytes"); }
    }

    return {
        "DTS":      DTS,
        "PTS":      PTS,
        "PAYLOAD":  payload,  // ByteStreamFormatUint8Array
        // --- unimportant properties ---
        "ESCR":     ESCR,
        "PES_private_data": PES_private_data,
    };

    function _isAudioStream(stream_id) {
        return stream_id >= 0xC0 && stream_id <= 0xDF;
    }
    function _isVideoStream(stream_id) {
        return stream_id >= 0xE0 && stream_id <= 0xEF;
    }
    function _isPaddingStream(stream_id) {
        return stream_id === 0xBE; // padding_stream
    }
    function _isHeader(stream_id) {
        if (stream_id !== 0xBC && // program_stream_map
            stream_id !== 0xBE && // padding_stream
            stream_id !== 0xBF && // private_stream_2
            stream_id !== 0xF0 && // ECM_stream
            stream_id !== 0xF1 && // EMM_stream
            stream_id !== 0xFF && // program_stream_directory
            stream_id !== 0xF2 && // ISO/IEC 13818-6_DSMCC_stream
            stream_id !== 0xF8) { // ITU-T Rec. H.222.1 type E
            return true;
        }
        return false;
    }
    function _isPayload(stream_id) {
        if (stream_id === 0xBC || // program_stream_map
          //stream_id === 0xBE || // padding_stream
            stream_id === 0xBF || // private_stream_2
            stream_id === 0xF0 || // ECM_stream
            stream_id === 0xF1 || // EMM_stream
            stream_id === 0xFF || // program_stream_directory
            stream_id === 0xF2 || // ISO/IEC 13818-6_DSMCC_stream
            stream_id === 0xF8) { // ITU-T Rec. H.222.1 type E
            return true;
        }
        return false;
    }
}

function _readTimeStamp33bit(subview) { // @arg Object - { source, cursor }
                                        // @ret Object - { time: Number, extension: 0 }
                                        // @desc read 33bit timestamp (90kHz based timestamp)
    //  |00001112|33333333|33333334|55555555|55555556|    bit index field
    //   ~~~~                                          -> 4   0     Splice_type
    //       ~~~                                       -> 3   1     DTS_next_AU[32..30]
    //          ~                                      -> 1   2     marker_bit
    //            ~~~~~~~~ ~~~~~~~                     -> 15  3     DTS_next_AU[29..15]
    //                            ~                    -> 1   4     marker_bit
    //                              ~~~~~~~~ ~~~~~~~   -> 15  5     DTS_next_AU[14..0]
    //                                              ~  -> 1   6     marker_bit
    var field1 = _split8(_read1(subview), [4, 3, 1]);
    var field2 = _split32(_read4(subview), [15, 1, 15, 1]);
    var filler1     = field1[0];  // `0001` or `0010` or `0011`
    var TIME_32_30  = field1[1];
    var marker_bit1 = field1[2];  // `1`
    var TIME_29_15  = field2[0];
    var marker_bit2 = field2[1];  // `1`
    var TIME_14_0   = field2[2];
    var marker_bit3 = field2[3];  // `1`

//{@dev
    if (VERIFY) {
        if (filler1 < 1 || filler1 > 3) { throw new TypeError("BAD FORMAT filler1: " + filler1); }
        if (marker_bit1 !== 1) { throw new TypeError("BAD FORMAT marker_bit1: " + marker_bit1); }
        if (marker_bit2 !== 1) { throw new TypeError("BAD FORMAT marker_bit2: " + marker_bit2); }
        if (marker_bit3 !== 1) { throw new TypeError("BAD FORMAT marker_bit3: " + marker_bit3); }
    }
//}@dev

    var result = ((TIME_32_30 >> 2 & 0x1) * 0x100000000) +
                  (TIME_32_30 << 29 |
                   TIME_29_15 << 15 |
                   TIME_14_0);
    return { time: result, extension: 0 };
}

function _readTimeStampESCR(subview) { // @arg Object - { source, cursor }
                                       // @ret Object - { time: Number, extension: Number }
    //  |00111233|33333333|33333411|11111111|11111233|33333334|    bit index field
    //  |~~                        |                          | ->   2 0     Reserved
    //  |  ~~~                     |                          | ->   3 1     ESCR_base[32..30]
    //  |     ~                    |                          | ->   1 2     marker_bit
    //  |      ~~ ~~~~~~~~ ~~~~~   |                          | ->  15 3     ESCR_base[29..15]
    //  |                       ~  |                          | ->   1 4     marker_bit
    //  +-----------------+--------+
    //  |                 |xxxxxx                             | ->   6 0     2度読み
    //  |                 |      ~~ ~~~~~~~~ ~~~~~            | ->  15 1     ESCR_base[14..0]
    //  |                 |                       ~           | ->   1 2     marker_bit
    //  |                 |                        ~~ ~~~~~~~ | ->   9 3     ESCR_extension
    //  |                 |                                  ~| ->   1 4     marker_bit
    var field1 = _split24(_read3(subview), [2, 3, 1, 15, 1]);
    subview.cursor--; // 1byte 戻り ESCR_base[14..0] を読みなおす

    var field2 = _split32(_read4(subview), [6, 15, 1, 9, 1]);
    var ESCR_base_32_30 = field1[1];
    var ESCR_base_29_15 = field1[3];
    var ESCR_base_14_0  = field2[1];
    var ESCR_extension  = field2[3];

    var result = ((ESCR_base_32_30 >> 2 & 0x1) * 0x100000000) +
                  (ESCR_base_32_30 << 29 |
                   ESCR_base_29_15 << 15 |
                   ESCR_base_14_0);
    return { time: result, extension: ESCR_extension };
}

/*
function _toTimeStampNumber(timeStamp, // @arg UINT - time stamp.
                            type) {    // @arg String - "PCR","SCR","STC", "PTS", "DTS"
                                       // @ret Number - sec.ms
                                       // @desc MPEG1/MPEG2 time stamp to date time.
    var clock = 0;

    switch (type) {
    case "PCR":
    case "SCR":
    case "STC":
        clock = 27 * 1000 * 1000; // 27MHz
        break;
    case "PTS":
    case "DTS":
        clock = 90 * 1000;        // 90kHz
        break;
    default:
        throw new TypeError("UNKNOWN TYPE:" + type);
    }
    return timeStamp / clock;
}
 */

// ------------------------------------------------------------------------
function _convertPESPacketToByteStream(pes) { // @arg PESPacketObjectArray - [{ PTS, DTS, PAYLOAD }, ...]
                                              // @ret ByteStreamUint8Array
                                              // @desc convert MPEG2PESPacket to Annex B ByteStream
    // PESPacket を結合し、ByteStream を生成します
    // ByteStream には 00 00 00 01 から始まる NALUnit が含まれています

//{@dev
    if (VERIFY) {
        $valid($type(pes, "PESPacketObjectArray"), _convertPESPacketToByteStream, "pes");
    }
//}@dev

    var byteStream = new Uint8Array( _getByteStreamBufferLength(pes) );
    var cursor = 0;

    for (var i = 0, iz = pes.length; i < iz; ++i) {
        byteStream.set(pes[i]["PAYLOAD"], cursor);
        cursor += pes[i]["PAYLOAD"].length;
    }
    return byteStream;
}

function _getByteStreamBufferLength(pes) {
    var totalBufferLength = 0;
    for (var i = 0, iz = pes.length; i < iz; ++i) {
        totalBufferLength += pes[i]["PAYLOAD"].length;
    }
    return totalBufferLength;
}

function _read4(view) { // @ret UINT32
    return ((view.source[view.cursor++]  << 24) |
            (view.source[view.cursor++]  << 16) |
            (view.source[view.cursor++]  <<  8) |
             view.source[view.cursor++]) >>> 0;
}

function _read3(view) { // @ret UINT32
    return ((view.source[view.cursor++]  << 16) |
            (view.source[view.cursor++]  <<  8) |
             view.source[view.cursor++]) >>> 0;
}

function _read2(view) { // @ret UINT16
    return ((view.source[view.cursor++]  <<  8) |
             view.source[view.cursor++]) >>> 0;
}

function _read1(view) { // @ret UINT8
    return view.source[view.cursor++] >>> 0;
}

return MPEG2TS; // return entity

});

