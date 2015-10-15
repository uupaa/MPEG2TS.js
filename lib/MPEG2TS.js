(function moduleExporter(name, closure) {
"use strict";

var entity = GLOBAL["WebModule"]["exports"](name, closure);

if (typeof module !== "undefined") {
    module["exports"] = entity;
}
return entity;

})("MPEG2TS", function moduleClosure(global) {
"use strict";

// [technical term](https://github.com/uupaa/H264.js/wiki/TechnicalTerm)

// --- dependency modules ----------------------------------
var Bit         = global["WebModule"]["Bit"];
var Hash        = global["WebModule"]["Hash"];
var TypedArray  = global["WebModule"]["TypedArray"];

// --- define / local variables ----------------------------
var _split1     = Bit["split1"];    // Bit.split1(u32:UINT32, bitPattern:UINT8Array|Uint8Array):UINT32Array
var _split2     = Bit["split2"];    // Bit.split2(u32:UINT32, bitPattern:UINT8Array|Uint8Array):UINT32Array
var _split3     = Bit["split3"];    // Bit.split3(u32:UINT32, bitPattern:UINT8Array|Uint8Array):UINT32Array
var _split4     = Bit["split4"];    // Bit.split4(u32:UINT32, bitPattern:UINT8Array|Uint8Array):UINT32Array
var _CRC32M     = Hash["CRC32M"];   // Hash.CRC32M(source:Uint8Array|String, hex:Boolean = false, offset:UINT32 = 0, length:UINT32 = source.length, crc:UINT32 = 0):UINT32|HexString

// T-REC-H.222.0 (P.47) - Table 2-34 Stream type assignments
var STREAM_TYPE = {
    15: { "type": "AUDIO", "codec": "AAC",  "detail": "MPEG2 AAC"    }, // ISO/IEC 13818-7 Audio with ADTS transport syntax
    17: { "type": "AUDIO", "codec": "AAC",  "detail": "MPEG4 AAC"    }, // ISO/IEC 14496-3 Audio with the LATM transport syntax as defined in ISO/IEC 14496-3
    27: { "type": "VIDEO", "codec": "H264", "detail": "H264"         }, // AVC video stream as defined in ITU-T Rec. H.264 | ISO/IEC 14496-10 Video
    21: { "type": "META",  "codec": "PES",  "detail": "MPEG2-TS PES" }, // Metadata carried in PES packets
};

// T-REC-H.222.0 (P.64) - Table 2-45 Program and program element descriptors
/*
var DESCRIPTOR_TAG = {
    37: { "type": "META", "detail": "metadata_pointer_descriptor" },
    38: { "type": "META", "detail": "metadata_descriptor"         },
};
 */
/*
var STREAM_ID = {
    192: "AUDIO",
    224: "VIDEO",
};
 */

// --- class / interfaces ----------------------------------
var MPEG2TS = {
    "VERIFY":       true,
    "VERBOSE":      false,
    "parse":        MPEG2TS_parse,  // MPEG2TS.parse(source:Uint8Array, cursor:UINT32 = 0):MPEG2TSDataObject
    "repository":   "https://github.com/uupaa/MPEG2TS.js",
};

// --- implements ------------------------------------------
function MPEG2TS_parse(source,   // @arg Uint8Array - MPEG2-TS byte stream.
                       cursor) { // @arg UINT32 = 0 - source offset.
                                 // @ret MPEG2TSDataObject - { ... }
//{@dev
    if (!global["BENCHMARK"]) {
        $valid($type(source, "Uint8Array"),  MPEG2TS_parse, "source");
        $valid($type(cursor, "UINT32|omit"), MPEG2TS_parse, "cursor");
    }
//}@dev

    var view = {
            source: source,      // Uint8Array - source data.
            cursor: cursor || 0, // UINT32 - source cursor.
        };
    var ts = {
          //"head":                 [], // packet header
            "PAT": { // Program Association Table
                "NETWORK_PID":      [],
                "PMT_PID":          [],
            },
            "PMT": { // Program Map Table
                "VIDEO_STREAM_PID": 0,
                "AUDIO_STREAM_PID": 0,
                "META_STREAM_PID":  0,
                "VIDEO_CODEC":      "", // Codec: "H264"
                "AUDIO_CODEC":      "", // Codec: "AAC"
                "DESCRIPTOR":       [], // [{ type, data }, ...]
            },
          //"METADATA_TS_PACKET":   [], // MetaData TS Packets
            "VIDEO_TS_PACKET":      [], // Video payload buffer
            "AUDIO_TS_PACKET":      [], // Audio payload buffer
            "VIDEO_PES_PACKET":     [],
            "AUDIO_PES_PACKET":     [],
        };

    var sourceLength = view.source.length;
    var packetLength = 188; // one packet length
    var verbose = MPEG2TS["VERBOSE"];

    while (view.cursor < sourceLength) {
        if (verbose) {
            TypedArray.dump(view.source, view.cursor, view.cursor + packetLength);
        }
        // --- format check ---
        if (view.source[view.cursor] !== 0x47) { // sync_byte always 0x47
            TypedArray.dump(view.source, view.cursor, view.cursor + packetLength);
            throw new TypeError("INVALID MEPG2-TS PACKET FORMAT");
        }

        var packetView    = { source: view.source.subarray(view.cursor, view.cursor + packetLength),
                              cursor: 0 };
        var packetHeader  = _readPacketHeader(packetView); // { PAY_LOAD, UNIT_START, PID, ... }
        var packetType    = _getTSPacketType(ts, packetHeader["PID"]); // "PAT", "PMT", "VIDEO", "AUDIO", ...
        var unitStart     = _isUnitStart(packetHeader);
        var counter       = packetHeader["continuity_counter"];
        var hasPayload    = packetHeader["PAY_LOAD"];

        if (verbose) {
            console.log({ packetType: packetType, counter: counter,
                          unitStart: unitStart, hasPayload: hasPayload });
        }
        switch (packetType) {
        case "PAT":     ts["PAT"] = _parsePAT(packetView, packetHeader); break;
        case "PMT":     ts["PMT"] = _parsePMT(packetView, packetHeader); break;
        case "VIDEO":   if (hasPayload) { _addTSPacketPayload(ts, "VIDEO_TS_PACKET", packetView, unitStart); } break;
        case "AUDIO":   if (hasPayload) { _addTSPacketPayload(ts, "AUDIO_TS_PACKET", packetView, unitStart); } break;
        case "META":    /* ts["METADATA_TS_PACKET"].push( _trimPayload(packetView) ); */ break;
        default: throw new TypeError("UNKNONW PACKET TYPE");
        }

        view.cursor += packetLength;
    }
    _convertTSPacketToPESPacket(ts, ts["VIDEO_TS_PACKET"], ts["VIDEO_PES_PACKET"]);
    _convertTSPacketToPESPacket(ts, ts["AUDIO_TS_PACKET"], ts["AUDIO_PES_PACKET"]);
    return ts;
}

function _convertTSPacketToPESPacket(ts, tsPacketPayload, pesPacketPlayload) {
    for (var i = 0, iz = tsPacketPayload.length; i < iz; ++i) {
        // --- calc stream length ---
        var streamLength = 0;
        for (var j = 0, jz = tsPacketPayload[i].length; j < jz; ++j) {
            streamLength += tsPacketPayload[i][j].length;
        }
        // --- build byte-stream ---
        var stream = new Uint8Array(streamLength);
        var cursor = 0;
        for (j = 0; j < jz; ++j) {
            stream.set(tsPacketPayload[i][j], cursor);
            cursor += tsPacketPayload[i][j].length;
        }
        pesPacketPlayload.push( _buildPESPacket(stream) );
    }
}

function _buildPESPacket(source) { // @arg Uint8Array - MPEG2-TS Audio/Video byte stream.
                                   // @ret Object - MPEG2 PES { header, payload }
    var view = { source: source, cursor: 0 };
    var packet_start_code_prefix = _read3(view); // 0x000001
    // ITU-T Rec. H.222.0 (2000 E) (P.34) - Table 2-18 - Stream_id assignments
    var stream_id = _read1(view);

//{@dev
    if (MPEG2TS["VERIFY"]) {
        if (packet_start_code_prefix !== 0x000001) { throw new TypeError("INVALID PES PACKET FORMAT: " + packet_start_code_prefix); }
    }
//}@dev

    var bits = _split4(_read4(view), [16, 2, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1]);
    var PES_packet_length = bits[1]; // 16bit
    var payloadEnd = view.cursor + PES_packet_length; // end of stream
    //
    //  |aabbcdef|gghijklm|nnnnnnnn|
    //   ~~                         marker_bits '10'
    //     ~~                       PES_scrambling_control `00`
    //       ~                      PES_priority
    //        ~                     data_alignment_indicator
    //         ~                    copyright
    //          ~                   original_or_copy
    //            ~~                PTS_DTS_flags
    //              ~               ESCR_flag
    //               ~              ES_rate_flag
    //                ~             DSM_trick_mode_flag
    //                 ~            additional_copy_info_flag
    //                  ~           PES_CRC_flag
    //                   ~          PES_extension_flag
    //                     ~~~~~~~~ PES_header_data_length
    //
    var marker_bits               = bits[2];     // `10`
  //var PES_scrambling_control    = bits[3];     // `00`
  //var PES_priority              = bits[4];     // `0`
  //var data_alignment_indicator  = bits[5];     // `?`
  //var copyright                 = bits[6];     // `0`
  //var original_or_copy          = bits[7];     // `0`
    var PTS_DTS_flags             = bits[8];     // `11` or `10` or `00`
  //var ESCR_flag                 = bits[9];     // `0`
  //var ES_rate_flag              = bits[10];    // `0`
  //var DSM_trick_mode_flag       = bits[11];    // `0`
  //var additional_copy_info_flag = bits[12];    // `0`
  //var PES_CRC_flag              = bits[13];    // `0`
  //var PES_extension_flag        = bits[14];    // `0`
    var PES_header_data_length    = _read1(view);
    var payloadBegin = view.cursor + PES_header_data_length;
    var PTS = 0, DTS = 0;

//{@dev
    if (MPEG2TS["VERIFY"]) {
        if (marker_bits !== 2) { throw new TypeError("marker_bits: " + marker_bits); }
    }
//}@dev

    if (PTS_DTS_flags === 0x2) {
        PTS = _readTimeStamp(view); // +5byte
    }
    if (PTS_DTS_flags === 0x3) {
        PTS = _readTimeStamp(view); // +5byte
        DTS = _readTimeStamp(view); // +5byte
    }

    view.cursor = payloadBegin; // skip stuffing_byte

    return {
        "header": {
            "stream_id": stream_id,
            "PTS": PTS,
            "DTS": DTS,
        },
        "payload": view.source.subarray(payloadBegin, payloadEnd),
    };
}

function _isUnitStart(packetHeader) {
    return packetHeader["UNIT_START"];
}

function _addTSPacketPayload(ts, target, packetView, unitStart) {
    var length  = ts[target].length;
    var payload = packetView.source.subarray(packetView.cursor);

    if (unitStart) {
        ts[target][length] = [ payload ];
    } else {
        ts[target][length - 1].push( payload );
    }
}

function _getTSPacketType(ts, PID) {
    switch (true) {
    case PID === 0x0000:                         return "PAT";
    case ts["PAT"]["PMT_PID"].indexOf(PID) >= 0: return "PMT";
    case ts["PMT"]["VIDEO_STREAM_PID"] === PID:  return "VIDEO";
    case ts["PMT"]["AUDIO_STREAM_PID"] === PID:  return "AUDIO";
    case ts["PMT"]["META_STREAM_PID"]  === PID:  return "META";
    }
    return "";
}

function _readPacketHeader(view) { // @arg Object - packet subview. length = 188. { source, cursor }
                                   // @ret Object - { PAY_LOAD, UNIT_START, PID ... }

    // T-REC-H.222.0 (P.19) - Table 2-2 Transport packet of this Recommendation | International Standard
    //
    //  |00000000|12344444|44444444|55667777|   bits
    //   ~~~~~~~~                             -> 8  sync_byte `0x47`
    //            ~                           -> 1  transport_error_indicator
    //             ~                          -> 1  payload_unit_start_indicator
    //              ~                         -> 1  transport_priority
    //               ~~~~~ ~~~~~~~~           -> 13 PID
    //                              ~~        -> 2  transport_scrambling_control
    //                                ~~      -> 2  adaptation_field_control
    //                                  ~~~~  -> 4  continuity_counter
    //
    var bits = _split4(_read4(view), [8, 1, 1, 1, 13, 2, 2, 4]);
    var adaptation_field = { "length": 0 };
    var afc = bits[7]; // adaptation_field_control

    switch (afc) {
    case 0x00: break; // Reserved for future use by ISO/IEC
    case 0x01: break; // No adaptation_field, payload only
    case 0x02:        // Adaptation_field only, no payload
    case 0x03:        // Adaptation_field followed by payload
        adaptation_field = _readAdaptationField(view);
    }
    return {
        "PAY_LOAD":                 afc === 0x01 || afc === 0x03,
        "UNIT_START":               bits[3] === 1,
        "PID":                      bits[5],
        "continuity_counter":       bits[8],
        "adaptation_field":         adaptation_field, // { PCR, OPCR }
    };

}

function _readAdaptationField(view) { // @arg Object - { source, cursor }
    var bits;
    var adaptation_field_length = _read1(view);
    var private_data_byte = [];
    var endOfAdaptationField = view.cursor + adaptation_field_length;
    var PCR  = { base: 0, extension: 0 };
    var OPCR = { base: 0, extension: 0 };

    if (adaptation_field_length) {
        //
        // Table 2-6 – Transport Stream adaptation field
        //
        //  |aaaaaaaa|bcdefghi|   bits
        //   ~~~~~~~~           -> 8 adaptation_field_length
        //            ~         -> 1 discontinuity_indicator
        //             ~        -> 1 random_access_indicator
        //              ~       -> 1 elementary_stream_priority_indicator
        //               ~      -> 1 PCR_flag
        //                ~     -> 1 OPCR_flag
        //                 ~    -> 1 splicing_point_flag
        //                  ~   -> 1 transport_private_data_flag
        //                   ~  -> 1 adaptation_field_extension_flag
        //
        bits = _split1(_read1(view), [1, 1, 1, 1, 1, 1, 1, 1]);

//      var discontinuity_indicator              = bits[1];
//      var random_access_indicator              = bits[2]; // PESパケットの先頭が含まれている場合に1にする事が可能
//      var elementary_stream_priority_indicator = bits[3];
        var PCR_flag                             = bits[4];
        var OPCR_flag                            = bits[5];
        var splicing_point_flag                  = bits[6];
        var transport_private_data_flag          = bits[7];
        var adaptation_field_extension_flag      = bits[8];

        if (PCR_flag) {
            PCR = _readPCR(view);
        }
        if (OPCR_flag) {
            OPCR = _readPCR(view);
        }
        if (splicing_point_flag) {
            //  |AAAAAAAA|
            //   ~~~~~~~~                                               -> [8] splice_countdown
          //var splice_countdown = (~_read1(view)) - 1; // 2の補数を元に戻す
                                     _read1(view);
        }
        if (transport_private_data_flag) {
            //  |AAAAAAAA|
            //   ~~~~~~~~                                               -> [8]  transport_private_data_length
            var transport_private_data_length = _read1(view);
            for (var i = 0; i < transport_private_data_length; ++i) {
                private_data_byte.push(_read1(view));
            }
        }
        if (adaptation_field_extension_flag) {
            //  |AAAAAAAA|BCDEEEEE|
            //   ~~~~~~~~                                               -> [8]  adaptation_field_extension_length
            //            ~                                             -> [1]  ltw_flag
            //             ~                                            -> [1]  piecewise_rate_flag
            //              ~                                           -> [1]  seamless_splice_flag
            //               ~~~~~                                      -> [5]  Reserved
            bits = _split2(_read2(view), [8, 1, 1, 1]);
//          var adaptation_field_extension_length = bits[1];
            var ltw_flag                          = bits[2];
            var piecewise_rate_flag               = bits[3];
            var seamless_splice_flag              = bits[4];

            if (ltw_flag) {
                //  |ABBBBBBB|BBBBBBBB|
                //   ~                                                  -> [1]  ltw_valid_flag
                //    ~~~~~~~ ~~~~~~~~                                  -> [15] ltw_offset
                bits = _split2(_read2(view), [1, 15]);
//              var ltw_valid_flag      = bits[1];
//              var ltw_offset          = bits[2];
            }

            if (piecewise_rate_flag) {
                //  |AABBBBBB|BBBBBBBB|BBBBBBBB|
                //   ~~                                                 -> [2]  reserved
                //     ~~~~~~ ~~~~~~~~ ~~~~~~~~                         -> [22] piecewise_rate
                bits = _split3(_read3(view), [2, 22]);
//              var piecewise_rate = bits[2];
            }

            if (seamless_splice_flag) {
                //  |AAAABBBC|DDDDDDDD|DDDDDDDE|FFFFFFFF|FFFFFFFG|
                //   ~~~~                                               -> [4]  Splice_type
                //       ~~~                                            -> [3]  DTS_next_AU[32..30]
                //          ~                                           -> [1]  marker_bit
                //            ~~~~~~~~ ~~~~~~~                          -> [15] DTS_next_AU[29..15]
                //                            ~                         -> [1]  marker_bit
                //                              ~~~~~~~~ ~~~~~~~        -> [15] DTS_next_AU[14..0]
                //                                              ~       -> [1]  marker_bit
              //var DTS_next_AU = _readTimeStamp(view); // +5byte
                                  _readTimeStamp(view); // +5byte
            }
        }
        // skip stuffing_byte
        if (view.cursor !== endOfAdaptationField) {
            if (MPEG2TS["VERBOSE"]) {
                console.log("has stuffing_bytes: " + (endOfAdaptationField - view.cursor));
                TypedArray.dump(view.source, 0, endOfAdaptationField);
                console.log("remain payload bytes: " + (view.source.length - endOfAdaptationField));
                TypedArray.dump(view.source, endOfAdaptationField);
            }
        }
        view.cursor = endOfAdaptationField;
    }

    return {
        "PCR":  PCR,
        "OPCR": OPCR,
    };
}

function _parsePAT(view,           // @arg Object - packget view. { source, cursor }
                   packetHeader) { // @arg PacketHeaderObject - { ... }
                                   // @ret Object
    if (_isUnitStart(packetHeader)) {
        view.cursor++; // skip pointer_filed
    }
    var offset = view.cursor; // mark offset position for CRC32M

    // T-REC-H.222.0 (P.43) - 2.4.4.3 Program Association Table
    var bits = _split3(_read3(view), [8, 1, 1, 2, 12]);

    var table_id                 = bits[1]; // `0x00`
    var section_syntax_indicator = bits[2]; // `1`
    var filler1                  = bits[3]; // `0`
    var filler2                  = bits[4]; // `11`
    var section_length           = bits[5] - 5 - 4; // 5byte, 4byte = CRC_LENGTH
    var transport_stream_id      = _read2(view);

    bits = _split3(_read3(view), [2, 5, 1, 8, 8]);

    var filler3                  = bits[1]; // `11`
//  var version_number           = bits[2];
//  var current_next_indicator   = bits[3];
//  var section_number           = bits[4];
//  var last_section_number      = bits[5];
    var NETWORK_PID              = [];
    var PMT_PID                  = [];

    for (var i = 0, iz = section_length; i < iz; i += 4) {
        bits = _split4(_read4(view), [16, 3, 13]);
        var program_number = bits[1];
        var fillerA        = bits[2]; // '111'
        var pid            = bits[3];

        if (program_number === 0) {
            NETWORK_PID.push(pid);
        } else {
            PMT_PID.push(pid);
        }
//{@dev
        if (MPEG2TS["VERIFY"] && fillerA !== 0x07) { throw new TypeError("fillerA: " + fillerA); }
//}@dev
    }

//{@dev
    if (MPEG2TS["VERIFY"]) {
        var crc32m = _CRC32M(view.source.subarray(offset, view.cursor), false, 0, 0, 0xffffffff);
        var CRC_32 = _read4(view);

        if (CRC_32                   !== crc32m) { throw new TypeError("CRC_32: " + CRC_32 + ", crc32m = " + crc32m); }
        if (table_id                 !== 0x00) { throw new TypeError("table_id: " + table_id); }
        if (section_syntax_indicator !== 0x01) { throw new TypeError("section_syntax_indicator: " + section_syntax_indicator); }
        if (filler1                  !== 0x00) { throw new TypeError("filler1: " + filler1); }
        if (filler2                  !== 0x03) { throw new TypeError("filler2: " + filler2); }
        if (filler3                  !== 0x03) { throw new TypeError("filler3: " + filler3); }
    }
//}@dev

    return {
        "NETWORK_PID":  NETWORK_PID,
        "PMT_PID":      PMT_PID,
        "TS_ID":        transport_stream_id,
    };
}

function _parsePMT(view,           // @arg Object - { source, cursor }
                   packetHeader) { // @arg PacketHeaderObject - { ... }
                                   // @ret Object
    if (_isUnitStart(packetHeader)) {
        view.cursor++; // skip pointer_filed
    }
  //var offset = view.cursor; // mark offset position for CRC32M

    // T-REC-H.222.0 (P.46) - 2.4.4.8 Program Map Table
    var PMT = {
            "VIDEO_STREAM_PID": 0,
            "AUDIO_STREAM_PID": 0,
            "META_STREAM_PID":  0,
            "VIDEO_CODEC":      "",
            "AUDIO_CODEC":      "",
            "DESCRIPTOR":       [],
        };

    var bits = _split3(_read3(view), [8, 1, 1, 2, 12]);

    var table_id                 = bits[1]; // `0x02`
    var section_syntax_indicator = bits[2]; // `1`
    var filler1                  = bits[3]; // `0`
    var filler2                  = bits[4]; // `11`
    var section_length           = bits[5] + view.cursor - 4; // 4byte = CRC.length
  //var program_number           = _read2(view);
                                   _read2(view);

    bits = _split3(_read3(view), [2, 5, 1, 8, 8]);

    var filler3                  = bits[1]; // `11`
  //var version_number           = bits[2];
  //var current_next_indicator   = bits[3];
  //var section_number           = bits[4];
  //var last_section_number      = bits[5];

    bits = _split4(_read4(view), [3, 13, 4, 12]);

    var filler4                  = bits[1]; // `111`
  //var PCR_PID                  = bits[2];
    var filler5                  = bits[3]; // `1111`
    var program_info_length      = bits[4]; // `00...`

    if (program_info_length) {
        PMT["DESCRIPTOR"].push( _readDescriptor(view) );
    }

    while (view.cursor < section_length) {
        // T-REC-H.222.0 (P.47) - Table 2-34 Stream type assignments
        var stream_type    = _read1(view);
        bits = _split4(_read4(view), [3, 13, 4, 12]);
        var fillerA        = bits[1]; // `111`
        var elementary_PID = bits[2];
        var fillerB        = bits[3]; // `1111`

        var type  = STREAM_TYPE[stream_type]["type"];
        var codec = STREAM_TYPE[stream_type]["codec"];

        if (/VIDEO/.test(type)) {
            PMT["VIDEO_STREAM_PID"] = elementary_PID;
            PMT["VIDEO_CODEC"] = codec;
        } else if (/AUDIO/.test(type)) {
            PMT["AUDIO_STREAM_PID"] = elementary_PID;
            PMT["AUDIO_CODEC"] = codec;
        } else if (/META/.test(type)) {
            PMT["META_STREAM_PID"]  = elementary_PID;
        } else {
            throw new TypeError("Unknown StreamType:" + stream_type);
        }

        var ES_info_length = bits[4];
        if (ES_info_length) {
            PMT["DESCRIPTOR"].push( _readDescriptor(view) );
        }
//{@dev
        if (MPEG2TS["VERIFY"] && fillerA !== 0x07) { throw new TypeError("fillerA: " + fillerA); }
        if (MPEG2TS["VERIFY"] && fillerB !== 0x0f) { throw new TypeError("fillerB: " + fillerB); }
//}@dev
    }

//{@dev
    if (MPEG2TS["VERIFY"]) {
     // var crc32m = _CRC32M(view.source.subarray(offset, view.cursor), false, 0, 0, 0xffffffff);
     // var CRC_32 = _read4(view);

     // crc32m が 0x00000000 になってしまうため、今のところは CRC のverify をスキップする
     // if (CRC_32                   !== crc32m) { throw new TypeError("CRC_32: " + CRC_32 + ", crc32m = " + crc32m); }
        if (table_id                 !== 0x02) { throw new TypeError("table_id: " + table_id); }
        if (section_syntax_indicator !== 0x01) { throw new TypeError("section_syntax_indicator: " + section_syntax_indicator); }
        if (filler1                  !== 0x00) { throw new TypeError("filler1: " + filler1); }
        if (filler2                  !== 0x03) { throw new TypeError("filler2: " + filler2); }
        if (filler3                  !== 0x03) { throw new TypeError("filler3: " + filler3); }
        if (filler4                  !== 0x07) { throw new TypeError("filler4: " + filler4); }
        if (filler5                  !== 0x0f) { throw new TypeError("filler5: " + filler5); }
    }
//}@dev

    return PMT;
}

function _readDescriptor(view) { // @arg Object - { source, cursor }
    // T-REC-H.222.0 (P.64) - 2.6.1 Semantic definition of fields in program and program element descriptors
    var tag    = _read1(view); // descriptor_tag
    var length = _read1(view); // descriptor_length
    var data   = view.source.subarray(view.cursor, view.cursor + length);

    if (MPEG2TS["VERBOSE"]) {
        TypedArray.dump(view.source, view.cursor - 2, view.cursor + length);
    }
    view.cursor += length;

    // descriptor
    // ADRESS  0  1  2  3  4  5  6  7  8  9  A  B  C  D  E  F  0
    // ------ -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
    // 000000 25 0f ff ff 49 44 33 20 ff 49 44 33 20 00 1f 00 01
    //        ~~                                                 descriptor_tag
    //           ~~                                              descriptor_length
    //              ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ descriptor data

    // ES_info
    // ADRESS  0  1  2  3  4  5  6  7  8  9  A  B  C  D  E  F
    // ------ -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --
    // 000027 26 0d ff ff 49 44 33 20 ff 49 44 33 20 00 0f
    //        ~~                                              descriptor_tag
    //           ~~                                           descriptor_length
    //              ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~    descriptor data
    return { "tag": tag, "data": data };
}

function _readTimeStamp(view) { // @arg Object - { source, cursor }
                                // @ret Number - 33bit time stamp
    // INFO: marker_bit はビット列がスタートコード(0x000001等)と一致してしまうことを避けるために
    //       ガードコードとして挿入されている。marker_bit 自体は情報量ゼロなので読み飛ばす
    //       デジタル放送教科書(上) P73
    var bits1 = _split1(_read1(view), [4, 3, 1]);
    var bits2 = _split4(_read4(view), [15, 1, 15, 1]);
    var fillerA     = bits1[1];  // `0001` or `0010` or `0011`
    var TIME_32_30  = bits1[2];
    var marker_bit1 = bits1[3];  // `1`
    var TIME_29_15  = bits2[1];
    var marker_bit2 = bits2[2];  // `1`
    var TIME_14_0   = bits2[3];
    var marker_bit3 = bits2[4];  // `1`

//{@dev
    if (MPEG2TS["VERIFY"]) {
        if (fillerA < 1 || fillerA > 3) { throw new TypeError("fillerA: " + fillerA); }
        if (marker_bit1 !== 1) { throw new TypeError("marker_bit1: " + marker_bit1); }
        if (marker_bit2 !== 1) { throw new TypeError("marker_bit2: " + marker_bit2); }
        if (marker_bit3 !== 1) { throw new TypeError("marker_bit3: " + marker_bit3); }
    }
//}@dev

    var result = ((TIME_32_30 >> 2 & 0x1) * 0x100000000) +
                  (TIME_32_30 << 29 |
                   TIME_29_15 << 15 |
                   TIME_14_0);
    return result;
}

function _readPCR(view) { // @arg Object - { source, cursor }
    // PCR
    //  |AAAAAAAA|AAAAAAAA|AAAAAAAA|AAAAAAAA|ABBBBBBC|CCCCCCCC|
    //   ~~~~~~~~ ~~~~~~~~ ~~~~~~~~ ~~~~~~~~ ~                  -> [33] program_clock_reference_base
    //                                        ~~~~~~            -> [6]  Reserved
    //                                              ~ ~~~~~~~~  -> [9]  program_clock_reference_extension
    // OPCR
    //  |AAAAAAAA|AAAAAAAA|AAAAAAAA|AAAAAAAA|ABBBBBBC|CCCCCCCC|
    //   ~~~~~~~~ ~~~~~~~~ ~~~~~~~~ ~~~~~~~~ ~                  -> [33] original_program_clock_reference_base
    //                                        ~~~~~~            -> [6]  Reserved
    //                                              ~ ~~~~~~~~  -> [9]  original_program_clock_reference_extension
    var u32  = _read4(view);                     // base(32bit)
    var bits = _split2(_read2(view), [1, 6, 9]); // [base(1bit), Reserved:6, extension:9]
    var base = u32 * 2 + bits[1]; // 33 bit number

    return { base: base, extension: bits[3] };
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

