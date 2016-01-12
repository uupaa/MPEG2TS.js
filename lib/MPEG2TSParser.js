(function moduleExporter(name, closure) {
"use strict";

var entity = GLOBAL["WebModule"]["exports"](name, closure);

if (typeof module !== "undefined") {
    module["exports"] = entity;
}
return entity;

})("MPEG2TSParser", function moduleClosure(global) {
"use strict";

// --- dependency modules ----------------------------------
var Bit     = global["WebModule"]["Bit"];
var HexDump = global["WebModule"]["HexDump"];

// --- define / local variables ----------------------------
var VERIFY  = global["WebModule"]["verify"]  || false;
var VERBOSE = global["WebModule"]["verbose"] || false;
var _split8  = Bit["split8"];  // Bit.split8(u32:UINT32, bitPattern:UINT8Array|Uint8Array):UINT32Array
var _split16 = Bit["split16"]; // Bit.split16(u32:UINT32, bitPattern:UINT8Array|Uint8Array):UINT32Array
var _split32 = Bit["split32"]; // Bit.split32(u32:UINT32, bitPattern:UINT8Array|Uint8Array):UINT32Array

// T-REC-H.222.0 (P.47) - Table 2-34 Stream type assignments
var STREAM_TYPE = {
    15: { "type": "AUDIO", "codec": "AAC", "detail": "MPEG2 AAC"    }, // ISO/IEC 13818-7 Audio with ADTS transport syntax
    17: { "type": "AUDIO", "codec": "AAC", "detail": "MPEG4 AAC"    }, // ISO/IEC 14496-3 Audio with the LATM transport syntax as defined in ISO/IEC 14496-3
    27: { "type": "VIDEO", "codec": "AVC", "detail": "AVC"          }, // AVC video stream as defined in ITU-T Rec. H.264 | ISO/IEC 14496-10 Video
    21: { "type": "META",  "codec": "PES", "detail": "MPEG2-TS PES" }, // Metadata carried in PES packets
};

// T-REC-H.222.0 (P.64) - Table 2-45 Program and program element descriptors
//var DESCRIPTOR_TAG = {
//    37: { "type": "META", "detail": "metadata_pointer_descriptor" },
//    38: { "type": "META", "detail": "metadata_descriptor"         },
//};

// --- class / interfaces ----------------------------------
var MPEG2TSParser = {
    "parse": MPEG2TSParser_parse, // MPEG2TSParser.parse(source:Uint8Array, cursor:UINT32 = 0):MPEG2TSPacketObject
};

// --- implements ------------------------------------------
function MPEG2TSParser_parse(source,   // @arg Uint8Array - MPEG-2 transport stream (raw level byte stream).
                             cursor) { // @arg UINT32 = 0 - source offset.
                                       // @ret MPEG2TSPacketObject - { PAT, PMT, VIDEO_TS_PACKET, ... }
//{@dev
    if (VERIFY) {
        $valid($type(source, "Uint8Array"),  MPEG2TSParser_parse, "source");
        $valid($type(cursor, "UINT32|omit"), MPEG2TSParser_parse, "cursor");
    }
//}@dev

    var view = { source: source, cursor: cursor || 0 };
    var mpeg2ts = {
            "PAT": { // Program Association Table
                "NET_PID":          [],
                "PMT_PID":          [], // ffmpeg で TS を生成した場合、PMT PID の初期値は 0x1000 から始まります
                                        // http://www.fixedpoint.jp/ffmpeg/muxers.html
            },
            "PMT": { // Program Map Table
                "VIDEO_STREAM_PID": 0,
                "AUDIO_STREAM_PID": 0,
                "META_STREAM_PID":  0,
                "VIDEO_CODEC":      "", // Codec: "AVC"
                "AUDIO_CODEC":      "", // Codec: "AAC"
                "DESCRIPTOR":       [], // [{ descriptor_type, descriptor_data, descriptor_string }, ...]
            },
            "VIDEO_TS_PACKET":      [], // Video payload buffer
            "AUDIO_TS_PACKET":      [], // Audio payload buffer
            "VIDEO_COUNTER":        [], // Video continuity_counter
            "AUDIO_COUNTER":        [], // Audio continuity_counter
        };

    var sourceLength = view.source.length;
    var packetLength = 188; // one packet length

    while (view.cursor < sourceLength) {
        var maybeSyncByte = view.source[view.cursor]; // read a byte. find sync_byte (0x47)

        if (maybeSyncByte === 0x47) { // found sync_byte
            var subview = view.source.subarray(view.cursor,
                                               view.cursor + packetLength);

            _readTSPacket({ source: subview, cursor: 0 }, mpeg2ts);
            view.cursor += packetLength;
        } else {
            view.cursor++; // skip unknown byte
        }
    }
    return mpeg2ts;
}

function _readTSPacket(subview,   // @arg Object - subview for read ts packet. length = 188. { source, cursor }
                       mpeg2ts) { // @arg Object - parse result

    // T-REC-H.222.0 (P.19) - Table 2-2 Transport packet of this Recommendation | International Standard
    //
    //  |00000000|12344444|44444444|55667777|    bit index field
    //   ~~~~~~~~                             -> 8   0     sync_byte: UINT8 `0x47`
    //            ~                           -> 1   1     transport_error_indicator: Boolean
    //             ~                          -> 1   2     payload_unit_start_indicator: Boolean
    //              ~                         -> 1   3     transport_priority: Boolean
    //               ~~~~~ ~~~~~~~~           -> 13  4     PID: UINT -> Table 2-3 - PID table
    //                              ~~        -> 2   5     transport_scrambling_control: UINT
    //                                ~~      -> 2   6     adaptation_field_control: UINT
    //                                  ~~~~  -> 4   7     continuity_counter: UINT - 巡回カウンタ
    //
    if (VERBOSE) {
        HexDump(subview.source, {
            title: "_readTSPacket",
            rule: {
                sync_byte: { begin: 0, end: 1, values: [0x47], style: "font-weight:bold;color:green" },
                PID:       { begin: 1, end: 3,                 style: "font-weight:bold;color:red"   },
                afc:       { begin: 3, end: 4,                 style: "font-weight:bold;color:blue"  }, // adaptation_field_control
            }
        });
    }

    var record = _split32(_read4(subview), [8, 1, 1, 1, 13, 2, 2, 4]);
    var afc = record[6]; // afc: adaptation_field_control

    var hasAdaptationField = afc === 0x2 || afc === 0x3;
    var hasPayload         = afc === 0x1 || afc === 0x3;
    var unitStart          = record[2] === 1;
    var PID                = record[4];
    var continuity_counter = record[7];
    var adaptation_field   = null; // { PCR, OPCR }
    var packetType         = "";
    var PCR                = 0;
    var OPCR               = 0;

    if (hasAdaptationField) {
        adaptation_field = _readAdaptationField(subview); // { PCR, OPCR }
        PCR  = adaptation_field["PCR"].base;
        OPCR = adaptation_field["OPCR"].base;
    }

    // Table 2-3 - PID table
    //
    //  | Value          | Description                           |
    //  |----------------|---------------------------------------|
    //  | 0x0000         | Program Association Table             |
    //  | 0x0001         | Conditional Access Table              |
    //  | 0x0002         | Transport Stream Description Table    |
    //  | 0x0003         | IPMP Control Information Table        |
    //  | 0x0004..0x000F | Reserved                              |
    //  | 0x0010..0x1FFE | May be assigned as network_PID, Program_map_PID, elementary_PID, or for other purposes |
    //  | 0x1FFF         | Null packet                           |
    //
    switch (PID) {
    case 0x0000: packetType = "PAT";  break;
    case 0x0001: packetType = "CAT";  break;
    case 0x0002: packetType = "TSDT"; break;
    case 0x0003: packetType = "IPMP"; break;
    case 0x1FFF: packetType = "NULL"; break;
    default:
        if (mpeg2ts["PAT"]["PMT_PID"].indexOf(PID) >= 0) { packetType = "PMT";   } else
        if (mpeg2ts["PAT"]["NET_PID"].indexOf(PID) >= 0) { packetType = "NET";   } else
        if (mpeg2ts["PMT"]["VIDEO_STREAM_PID"] === PID)  { packetType = "VIDEO"; } else
        if (mpeg2ts["PMT"]["AUDIO_STREAM_PID"] === PID)  { packetType = "AUDIO"; } else
        if (mpeg2ts["PMT"]["META_STREAM_PID"]  === PID)  { packetType = "META";  } else
        if (PID >= 0x0010 && PID <= 0x1FFE)              { packetType = "USER";  } // user defined PID.
    }
    if (hasPayload) { // packet has payload
        switch (packetType) {
        case "PAT":
            // mpeg2ts.PAT = { NET_PID, PMT_PID }
            mpeg2ts["PAT"] = _readPAT(subview, unitStart);
            break;
        case "PMT":
            // mpeg2ts.PMT = { VIDEO_STREAM_PID, AUDIO_STREAM_PID, META_STREAM_PID, VIDEO_CODEC, AUDIO_CODEC, DESCRIPTOR }
            mpeg2ts["PMT"] = _readPMT(subview, unitStart);
            break;
        case "VIDEO":
            if (VERBOSE) {
                console.log("VIDEO PACKET. PID = " + PID,
                            "PCR = "  + PCR  + "(" + (PCR  / 90000) + " sec)",
                            "OPCR = " + OPCR + "(" + (OPCR / 90000) + " sec)" );
            }
            _storeTSPacketPayload(subview, unitStart, mpeg2ts["VIDEO_TS_PACKET"]);
            _storeContinuityCounter(continuity_counter, unitStart, mpeg2ts["VIDEO_COUNTER"]);
            break;
        case "AUDIO":
            if (VERBOSE) {
                console.log("AUDIO PACKET. PID = " + PID,
                            "PCR = "  + PCR  + "(" + (PCR  / 90000) + " sec)",
                            "OPCR = " + OPCR + "(" + (OPCR / 90000) + " sec)" );
            }
            _storeTSPacketPayload(subview, unitStart, mpeg2ts["AUDIO_TS_PACKET"]);
            _storeContinuityCounter(continuity_counter, unitStart, mpeg2ts["AUDIO_COUNTER"]);
            break;
        case "META":
            break;
        case "NULL":
            break;
        case "USER":
            if (VERBOSE) {
                console.log("USER DEFINED PID: 0x" + PID.toString(16));
            }
            break;
        default:
            console.log("UNKNOWN PID: 0x" + PID.toString(16));
        }
    }

    function _storeTSPacketPayload(subview, unitStart, target) {
        var payload = subview.source.subarray(subview.cursor);

        if (unitStart) {
            target[target.length] = [ payload ];
        } else {
            target[target.length - 1].push( payload );
        }
    }
    function _storeContinuityCounter(continuity_counter, unitStart, target) {
        if (unitStart) {
            target[target.length] = [ continuity_counter ];
        } else {
            target[target.length - 1].push( continuity_counter );
        }
    }
}

function _readAdaptationField(subview) { // @arg Object - { source, cursor }
                                         // @ret - { PCR, OPCR }
    var adaptation_field_length = _read1(subview);
    var adaptation_field_end    = subview.cursor + adaptation_field_length;
//  var private_data_byte = [];
    var PCR  = { base: 0, extension: 0 };
    var OPCR = { base: 0, extension: 0 };

    if (adaptation_field_length) {
        //
        // T-REC-H.222.0 (P.22) - Table 2-6 - Transport Stream adaptation field
        //
        //  |01234567|    bit index field
        //   ~         -> 1   0     discontinuity_indicator
        //    ~        -> 1   1     random_access_indicator
        //     ~       -> 1   2     elementary_stream_priority_indicator
        //      ~      -> 1   3     PCR_flag
        //       ~     -> 1   4     OPCR_flag
        //        ~    -> 1   5     splicing_point_flag
        //         ~   -> 1   6     transport_private_data_flag
        //          ~  -> 1   7     adaptation_field_extension_flag
        //
        var field1 = _split8(_read1(subview), [1, 1, 1, 1, 1, 1, 1, 1]);
//      var discontinuity_indicator              = field1[0]; // 本来は40ms間隔で送信されるべきPCRが、100ms以上送信されない場合に1になる
//      var random_access_indicator              = field1[1]; // PESパケットの先頭が含まれている場合に1にする事が可能
//      var elementary_stream_priority_indicator = field1[2];
        var PCR_flag                             = field1[3];
        var OPCR_flag                            = field1[4];
        var splicing_point_flag                  = field1[5];
        var transport_private_data_flag          = field1[6];
        var adaptation_field_extension_flag      = field1[7];

        if (PCR_flag) {
            PCR = _readPCR(subview);
        }
        if (OPCR_flag) {
            OPCR = _readPCR(subview);
        }
        if (splicing_point_flag) {
            //  |00000000|    bit index field
            //   ~~~~~~~~  -> 8   0     splice_countdown
          //var splice_countdown = (~_read1(subview)) - 1; // 2の補数を元に戻す
            subview.cursor += 1;
        }
        if (transport_private_data_flag) {
            //  |00000000|    bit index field
            //   ~~~~~~~~  -> 8   0     transport_private_data_length
            var transport_private_data_length = _read1(subview);
          //for (var i = 0; i < transport_private_data_length; ++i) {
          //    private_data_byte.push(_read1(subview));
          //}
            subview.cursor += transport_private_data_length;
        }
        if (adaptation_field_extension_flag) {
            var adaptation_field_extension_length = _read1(subview);
            var adaptation_field_extension_end    = subview.cursor + adaptation_field_extension_length;

            //  |01233333|    bit index field
            //   ~         -> 1   1     ltw_flag
            //    ~        -> 1   2     piecewise_rate_flag
            //     ~       -> 1   3     seamless_splice_flag
            //      ~~~~~  -> 5   4     Reserved
            var field2               = _split8(_read1(subview), [1, 1, 1]);
            var ltw_flag             = field2[0];
            var piecewise_rate_flag  = field2[1];
            var seamless_splice_flag = field2[2];

            if (ltw_flag) {
                //  |01111111|11111111|    bit index field
                //   ~                  -> 1   0     ltw_valid_flag
                //    ~~~~~~~ ~~~~~~~~  -> 15  1     ltw_offset
                //_split16(_read2(subview), [1, 15]);
                subview.cursor += 2;
            }
            if (piecewise_rate_flag) {
                //  |00111111|11111111|11111111|    bit index field
                //   ~~                          -> 2   0     reserved
                //     ~~~~~~ ~~~~~~~~ ~~~~~~~~  -> 22  1     piecewise_rate
                //_split24(_read3(subview), [2, 22]);
                subview.cursor += 3;
            }
            if (seamless_splice_flag) {
                //  |00001112|33333333|33333334|55555555|55555556|    bit index field
                //   ~~~~                                          -> 4   0     Splice_type
                //       ~~~                                       -> 3   1     DTS_next_AU[32..30]
                //          ~                                      -> 1   2     marker_bit
                //            ~~~~~~~~ ~~~~~~~                     -> 15  3     DTS_next_AU[29..15]
                //                            ~                    -> 1   4     marker_bit
                //                              ~~~~~~~~ ~~~~~~~   -> 15  5     DTS_next_AU[14..0]
                //                                              ~  -> 1   6     marker_bit
                //_readTimeStamp(subview).time; // +5byte
                subview.cursor += 5;
            }
            subview.cursor = adaptation_field_extension_end;
        }
        // skip stuffing_byte
        subview.cursor = adaptation_field_end;
    }
    return { "PCR": PCR, "OPCR": OPCR };
}

function _readPAT(subview,     // @arg Object - packet subview. { source, cursor }
                  unitStart) { // @arg Boolean - skip pointer_filed
                               // @ret Object - { NET_PID, PMT_PID }
                               // @desc T-REC-H.222.0 (P.43) - 2.4.4.3 Program Association Table
    var NET_PID = [];
    var PMT_PID = [];

    if (unitStart) {
        subview.cursor++; // skip pointer_filed
    }

    var offset   = subview.cursor;  // mark offset position for CRC32M
    var table_id = _read1(subview); // Table 2-31 - table_id assignment values

    // Table 2-30 - Program association section
    //
    // |01123333|33333333|44444444|44444444|00111112|   bit index field
    // |~                                  |         -> 1   0     section_syntax_indicator
    // | ~                                 |         -> 1   1     filler `0`
    // |  ~~                               |         -> 2   2     filler `11`
    // |    ~~~~ ~~~~~~~~                  |         -> 12  3     section_length
    // |                  ~~~~~~~~ ~~~~~~~~|         -> 16  4     transport_stream_id
    // +-----------------------------------+-----------------------------------------
    // |                                   |~~       -> 2   0     filler `11`
    // |                                   |  ~~~~~  -> 5   1     version_number
    // |                                   |       ~ -> 1   2     current_next_indicator
    var field1                   = _split32(_read4(subview), [1, 1, 2, 12, 16]);
    var section_syntax_indicator = field1[0]; // `1`
    var filler1                  = field1[1]; // `0`
    var filler2                  = field1[2]; // `11`
    var section_length           = field1[3] - 5 - 4; // 5byte, 4byte = CRC_LENGTH
    var transport_stream_id      = field1[4];
    var field2                   = _split8(_read1(subview), [2, 5, 1]); // [3, 0, 1]
    var filler3                  = field2[0]; // `11`
    var version_number           = field2[1];
    var current_next_indicator   = field2[2];
    var section_number           = _read1(subview); // 0
    var last_section_number      = _read1(subview); // 0

    for (var i = 0, iz = section_length; i < iz; i += 4) {
        //
        // |00000000|00000000|11122222|22222222|   bit index field
        //  ~~~~~~~~ ~~~~~~~~                   -> 16  0     program_number
        //                    ~~~               ->  3  1     reserved
        //                       ~~~~~ ~~~~~~~~ -> 13  2     network_PID or program_map_PID
        var field = _split32(_read4(subview), [16, 3, 13]); // [1, 7, 4095]
        var program_number = field[0];
        var filler4        = field[1]; // `111`
        var pid            = field[2]; // 4095

        // 収納されているPIDのリストを取得します
        // program_number === 0 は NETWORK_PID です
        if (program_number === 0) {
            NET_PID.push(pid);
        } else {
            PMT_PID.push(pid);
        }
//{@dev
        if (VERIFY) {
            if (filler4 !== 7) { throw new TypeError("BAD_FORMAT filler4: ", filler4); }
        }
//}@dev
    }

//{@dev
    if (VERIFY) {
        var CRC_32 = _read4(subview);
        if (CRC_32 === _calcCRC32M(_createSubView(subview.source, offset, subview.cursor - 4))) {
            throw new TypeError("CRC ERROR");
        }
        if (filler1 !== 0) { throw new TypeError("BAD_FORMAT filler1: ", filler1); }
        if (filler2 !== 3) { throw new TypeError("BAD_FORMAT filler2: ", filler2); }
        if (filler3 !== 3) { throw new TypeError("BAD_FORMAT filler3: ", filler3); }
    }
//}@dev

    return {
        "NET_PID": NET_PID,
        "PMT_PID": PMT_PID,
        // --- unimportant properties ---
        "table_id":                 table_id,
        "section_syntax_indicator": section_syntax_indicator,
        "transport_stream_id":      transport_stream_id,
        "version_number":           version_number,
        "current_next_indicator":   current_next_indicator,
        "section_number":           section_number,
        "last_section_number":      last_section_number,
    };
}

function _readPMT(subview,     // @arg Object - packet subview. { source, cursor }
                  unitStart) { // @arg Boolean - skip pointer_filed
                               // @ret Object - { VIDEO_STREAM_PID, AUDIO_STREAM_PID, META_STREAM_PID, VIDEO_CODEC, AUDIO_CODEC, DESCRIPTOR }
                               // @desc T-REC-H.222.0 (P.46) - 2.4.4.8 Program Map Table
    var VIDEO_STREAM_PID = 0;
    var AUDIO_STREAM_PID = 0;
    var META_STREAM_PID  = 0;
    var VIDEO_CODEC      = "";
    var AUDIO_CODEC      = "";
    var DESCRIPTOR       = [];

    if (unitStart) {
        subview.cursor++; // skip pointer_filed
    }

    var offset = subview.cursor; // mark offset position for CRC32M
    var table_id = _read1(subview); // `0x02`

    // Table 2-33 - Transport Stream program map section
    //
    // |01223333|33333333|00000000|00000000|00111113|00011111|11111111|22223333|33333333|    bit index field
    // |~                |                 |        |                                   | -> 1   0     section_syntax_indicator `1`
    // | ~               |                 |        |                                   | -> 1   1     zero `0`
    // |  ~~             |                 |        |                                   | -> 2   2     reserved `11`
    // |    ~~~~ ~~~~~~~~|                 |        |                                   | -> 12  3     section_length
    // +-----------------+-----------------+--------+-----------------------------------+
    // |                 |~~~~~~~~ ~~~~~~~~|        |                                   | -> 16  4     program_number
    // +-----------------+-----------------+--------+-----------------------------------+
    // |                 |                 |~~      |                                   | -> 2   0     reserved
    // |                 |                 |  ~~~~~ |                                   | -> 5   1     version_number
    // |                 |                 |       ~|                                   | -> 1   2     current_next_indicator
    // +-----------------+-----------------+--------+-----------------------------------+
    // |                 |                 |        |~~~                                | -> 3   0     reserved
    // |                 |                 |        |   ~~~~~ ~~~~~~~~                  | -> 13  1     PCR_PID
    // |                 |                 |        |                  ~~~~             | -> 4   2     reserved
    // |                 |                 |        |                      ~~~~ ~~~~~~~~| -> 12  3     program_info_length
    // +-----------------+-----------------+--------+-----------------------------------+
    var field1                   = _split16(_read2(subview), [1, 1, 2, 12]);
    var section_syntax_indicator = field1[0]; // `1`
    var filler1                  = field1[1]; // `0`
    var filler2                  = field1[2]; // `11`
    var section_length           = field1[3] + subview.cursor - 4; // 4byte = CRC.length
    var program_number           = _read2(subview);
    var field2                   = _split8(_read1(subview), [2, 5, 1]);
    var filler3                  = field2[0]; // `11`
    var version_number           = field2[1];
    var current_next_indicator   = field2[2];
    var section_number           = _read1(subview);
    var last_section_number      = _read1(subview);
    var field3                   = _split32(_read4(subview), [3, 13, 4, 12]);
    var filler4                  = field3[0]; // `111`
    var PCR_PID                  = field3[1];
    var filler5                  = field3[2]; // `1111`
    var program_info_length      = field3[3]; // `00` + length

//{@dev
    if (VERIFY) {
        if (filler1 !== 0x0) { throw new TypeError("BAD_FORMAT filler1: " + filler1); }
        if (filler2 !== 0x3) { throw new TypeError("BAD_FORMAT filler2: " + filler2); }
        if (filler3 !== 0x3) { throw new TypeError("BAD_FORMAT filler3: " + filler3); }
        if (filler4 !== 0x7) { throw new TypeError("BAD_FORMAT filler4: " + filler4); }
        if (filler5 !== 0xf) { throw new TypeError("BAD_FORMAT filler5: " + filler5); }
    }
//}@dev

    if (program_info_length) {
        DESCRIPTOR.push( _readDescriptor(subview) );
    }

    while (subview.cursor < section_length) {
        // Table 2-33 - Transport Stream program map section
        //
        // |00011111|11111111|22223333|33333333|   bit index field
        // |~~~                                 ->  3  0     reserved
        // |   ~~~~~ ~~~~~~~~                   -> 13  1     elementary_PID
        // |                  ~~~~              ->  4  2     reserved
        // |                      ~~~~ ~~~~~~~~ -> 12  3     ES_info_length
        //
        var stream_type    = _read1(subview);
        var field4         = _split32(_read4(subview), [3, 13, 4, 12]);
        var filler6        = field4[0]; // `111`
        var elementary_PID = field4[1];
        var filler7        = field4[2]; // `1111`
        var ES_info_length = field4[3];

//{@dev
        if (VERIFY) {
            if (filler6 !== 0x7) { throw new TypeError("BAD FORMAT filler6: " + filler6); }
            if (filler7 !== 0xf) { throw new TypeError("BAD FORMAT filler7: " + filler7); }
        }
//}@dev

        // (P.47) Table 2-34 Stream type assignments
        if (stream_type in STREAM_TYPE) {
            var type = STREAM_TYPE[stream_type]["type"];

            if (/VIDEO/.test(type)) {
                VIDEO_STREAM_PID = elementary_PID;
                VIDEO_CODEC      = STREAM_TYPE[stream_type]["codec"];
            } else if (/AUDIO/.test(type)) {
                AUDIO_STREAM_PID = elementary_PID;
                AUDIO_CODEC      = STREAM_TYPE[stream_type]["codec"];
            } else if (/META/.test(type)) {
                META_STREAM_PID  = elementary_PID;
            }
        } else if (stream_type >= 0x80 && stream_type <= 0xff) {
            if (VERBOSE) {
                console.log("Private StreamType: " + stream_type);
            }
        } else {
            throw new TypeError("UNKNOWN StreamType: " + stream_type);
        }

        // read ES info descripter
        if (ES_info_length) {
            DESCRIPTOR.push( _readDescriptor(subview) );
        }
    }

//{@dev
    if (VERIFY) {
        var CRC_32 = _read4(subview);
        if (CRC_32 === _calcCRC32M(_createSubView(subview.source, offset, subview.cursor - 4))) {
            throw new TypeError("CRC ERROR");
        }
    }
//}@dev

    return {
        "VIDEO_STREAM_PID": VIDEO_STREAM_PID,
        "AUDIO_STREAM_PID": AUDIO_STREAM_PID,
        "META_STREAM_PID":  META_STREAM_PID,
        "VIDEO_CODEC":      VIDEO_CODEC,
        "AUDIO_CODEC":      AUDIO_CODEC,
        "DESCRIPTOR":       DESCRIPTOR,
        // --- unimportant properties ---
        "table_id":                 table_id,
        "section_syntax_indicator": section_syntax_indicator,
        "program_number":           program_number,
        "version_number":           version_number,
        "current_next_indicator":   current_next_indicator,
        "section_number":           section_number,
        "last_section_number":      last_section_number,
        "PCR_PID":                  PCR_PID,
    };
}

function _readDescriptor(subview) { // @arg Object - { source, cursor }
                                    // @ret Object - { descriptor_tag, descriptor_data, descriptor_string }
                                    // @desc T-REC-H.222.0 (P.64) - 2.6.1 Semantic definition of fields in program and program element descriptors
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
    var descriptor_tag    = _read1(subview); // descriptor_tag
    var descriptor_length = _read1(subview); // descriptor_length
    var descriptor_data   = subview.source.subarray(subview.cursor,
                                                    subview.cursor + descriptor_length);
    var descriptor_string = String.fromCharCode.apply(null, descriptor_data);
    subview.cursor += length;

//{@dev
    if (VERBOSE) {
        HexDump(descriptor_string, {
            title: "_readDescriptor.descriptor_string",
            rule: {
            }
        });
    }
//}@dev

    return {
        "descriptor_tag":    descriptor_tag,
        "descriptor_data":   descriptor_data,
        "descriptor_string": descriptor_string,
    };
}

function _readPCR(subview) { // @arg Object - { source, cursor }
                             // @ret Object - { base, extension }
                             // @desc read program clock reference.
    // PCR
    //  |00000000|00000000|00000000|00000000|01111112|22222222|    bit index filed
    //  |~~~~~~~~ ~~~~~~~~ ~~~~~~~~ ~~~~~~~~|~                  -> 33  0     program_clock_reference_base
    //  |                                   | ~~~~~~            ->  6  1     Reserved
    //  |                                   |       ~ ~~~~~~~~  ->  9  2     program_clock_reference_extension

    // OPCR
    //  |00000000|00000000|00000000|00000000|01111112|22222222|    bit index filed
    //  |~~~~~~~~ ~~~~~~~~ ~~~~~~~~ ~~~~~~~~|~                  -> 33  0     original_program_clock_reference_base
    //  |                                   | ~~~~~~            ->  6  1     Reserved
    //  |                                   |       ~ ~~~~~~~~  ->  9  2     original_program_clock_reference_extension
    var u32   = _read4(subview);                     // base(32bit)
    var filed = _split16(_read2(subview), [1, 6, 9]); // [base(1bit), Reserved:6, extension:9]
    var base  = u32 * 2 + filed[0]; // Number: 33bits

    return { base: base, extension: filed[2] };
}

function _read4(view) { // @ret UINT32
    return ((view.source[view.cursor++]  << 24) |
            (view.source[view.cursor++]  << 16) |
            (view.source[view.cursor++]  <<  8) |
             view.source[view.cursor++]) >>> 0;
}

//function _read3(view) { // @ret UINT32
//    return ((view.source[view.cursor++]  << 16) |
//            (view.source[view.cursor++]  <<  8) |
//             view.source[view.cursor++]) >>> 0;
//}

function _read2(view) { // @ret UINT16
    return ((view.source[view.cursor++]  <<  8) |
             view.source[view.cursor++]) >>> 0;
}

function _read1(view) { // @ret UINT8
    return view.source[view.cursor++] >>> 0;
}

function _createSubView(source, cursor, packetLength) {
    return { source: source.subarray(cursor, cursor + packetLength), cursor: 0 };
}

function _calcCRC32M() {
    // TODO: impl
    return true;
}

return MPEG2TSParser; // return entity

});

