(function moduleExporter(name, closure) {
"use strict";

var entity = GLOBAL["WebModule"]["exports"](name, closure);

if (typeof module !== "undefined") {
    module["exports"] = entity;
}
return entity;

})("MPEG2TSDemuxer", function moduleClosure(global, WebModule, VERIFY, VERBOSE) {
"use strict";

// --- technical terms / data structure --------------------
// --- dependency modules ----------------------------------
var Bit      = WebModule["Bit"];
var Hash     = WebModule["Hash"];
var HexDump  = WebModule["HexDump"];
// --- import / local extract functions --------------------
var _split8  = Bit["split8"];  // Bit.split8(u32:UINT32, bitPattern:UINT8Array|Uint8Array):UINT32Array
var _split16 = Bit["split16"]; // Bit.split16(u32:UINT32, bitPattern:UINT8Array|Uint8Array):UINT32Array
var _split32 = Bit["split32"]; // Bit.split32(u32:UINT32, bitPattern:UINT8Array|Uint8Array):UINT32Array
// --- define / local variables ----------------------------

// T-REC-H.222.0 (P.47) - Table 2-34 Stream type assignments
// The '2007' aka ISO/IEC 13818-1 2007
var TYPE_OTHER = 0;
var TYPE_VIDEO = 1;
var TYPE_AUDIO = 2;
var TYPE_META  = 3;
var TYPE_TEXT  = 4;

var STREAM_TYPE_START = 0x00;
var STREAM_TYPE_END = 0x1D;
var STREAM_TYPE = {
    0x00: { type: TYPE_OTHER,              }, //       ITU-T | ISO/IEC Reserved
    0x01: { type: TYPE_VIDEO,              }, //       ISO/IEC 11172-2 Video
    0x02: { type: TYPE_VIDEO,              }, //       ITU-T Rec. H.262 | ISO/IEC 13818-2 Video or ISO/IEC 11172-2 constrained parameter video stream
    0x03: { type: TYPE_AUDIO               }, //       ISO/IEC 11172-3 Audio
    0x04: { type: TYPE_AUDIO               }, //       ISO/IEC 13818-3 Audio
    0x05: { type: TYPE_OTHER               }, //       ITU-T Rec. H.222.0 | ISO/IEC 13818-1 private_sections
    0x06: { type: TYPE_OTHER               }, //       ITU-T Rec. H.222.0 | ISO/IEC 13818-1 PES packets containing private data
    0x07: { type: TYPE_OTHER               }, //       ISO/IEC 13522 MHEG
    0x08: { type: TYPE_OTHER               }, //       ITU-T Rec. H.222.0 | ISO/IEC 13818-1 Annex A DSM-CC
    0x09: { type: TYPE_OTHER               }, //       ITU-T Rec. H.222.1
    0x0A: { type: TYPE_OTHER               }, //       ISO/IEC 13818-6 type A
    0x0B: { type: TYPE_OTHER               }, //       ISO/IEC 13818-6 type B
    0x0C: { type: TYPE_OTHER               }, //       ISO/IEC 13818-6 type C
    0x0D: { type: TYPE_OTHER               }, //       ISO/IEC 13818-6 type D
    0x0E: { type: TYPE_OTHER               }, //       ITU-T Rec. H.222.0 | ISO/IEC 13818-1 auxiliary
    0x0F: { type: TYPE_AUDIO, codec: "AAC" }, //       ISO/IEC 13818-7 Audio with ADTS transport syntax (MPEG2 AAC)
    0x10: { type: TYPE_OTHER               }, //       ISO/IEC 14496-2 Visual
    0x11: { type: TYPE_AUDIO               }, // 2007: ISO/IEC 14496-3 Audio with the LATM transport syntax as defined in ISO/IEC 14496-3/Amd.1
    0x12: { type: TYPE_AUDIO, codec: "AAC" }, //       ISO/IEC 14496-1 SL-packetized stream or FlexMux stream carried in PES packets (MPEG4 AAC)
    0x13: { type: TYPE_AUDIO,              }, // 2007: ISO/IEC 14496-1 SL-packetized stream or FlexMux stream carried in ISO/IEC 14496_sections
    0x14: { type: TYPE_OTHER,              }, // 2007: ISO/IEC 13818-6 Synchronized Download Protocol
    0x15: { type: TYPE_META,  codec: "PES" }, //       Metadata carried in PES packets (MPEG2-TS PES)
    0x16: { type: TYPE_META                }, //       Metadata carried in metadata_sections
    0x17: { type: TYPE_META                }, // 2007: Metadata carried in ISO/IEC 13818-6 Data Carousel
    0x18: { type: TYPE_META                }, // 2007: Metadata carried in ISO/IEC 13818-6 Object Carousel
    0x19: { type: TYPE_META                }, // 2007: Metadata carried in ISO/IEC 13818-6 Synchronized Download Protocol
    0x1A: { type: TYPE_META                }, //       IPMP stream (defined in ISO/IEC 13818-11, MPEG-2 IPMP)
    0x1B: { type: TYPE_VIDEO, codec: "AVC" }, //       AVC video stream as defined in ITU-T Rec. H.264 | ISO/IEC 14496-10 Video (AVC)
    0x1C: { type: TYPE_AUDIO,              }, // 2007: ISO/IEC 14496-3 Audio, without using any additional transport syntax, such as DST, ALS and SLS (MPEG2 AAC)
    0x1D: { type: TYPE_TEXT                }, // 2007: ISO/IEC 14496-17 Text
  //0x7F: { type: TYPE_OTHER               }, // 2007: IPMP stream
};

// T-REC-H.222.0 (P.64) - Table 2-45 Program and program element descriptors
var DESCRIPTOR_TAG = {
     2:   { type: TYPE_VIDEO }, // video_stream_descriptor
     3:   { type: TYPE_AUDIO }, // audio_stream_descriptor
     4:   { type: TYPE_OTHER }, // hierarchy_descriptor
     5:   { type: TYPE_OTHER }, // registration_descriptor
     6:   { type: TYPE_OTHER }, // data_stream_alignment_descriptor
     7:   { type: TYPE_OTHER }, // target_background_grid_descriptor
     8:   { type: TYPE_OTHER }, // video_window_descriptor
     9:   { type: TYPE_OTHER }, // CA_descriptor
    10:   { type: TYPE_OTHER }, // ISO_639_language_descriptor
    11:   { type: TYPE_OTHER }, // system_clock_descriptor
    12:   { type: TYPE_OTHER }, // multiplex_buffer_utilization_descriptor
    13:   { type: TYPE_OTHER }, // copyright_descriptor
    14:   { type: TYPE_OTHER }, // maximum_bitrate_descriptor
    15:   { type: TYPE_OTHER }, // private_data_indicator_descriptor
    16:   { type: TYPE_OTHER }, // smoothing_buffer_descriptor
    17:   { type: TYPE_OTHER }, // STD_descriptor
    18:   { type: TYPE_OTHER }, // IBP_descriptor
    19:   { type: TYPE_OTHER }, // Defined in ISO/IEC 13818-6
    20:   { type: TYPE_OTHER }, // Defined in ISO/IEC 13818-6
    21:   { type: TYPE_OTHER }, // Defined in ISO/IEC 13818-6
    22:   { type: TYPE_OTHER }, // Defined in ISO/IEC 13818-6
    23:   { type: TYPE_OTHER }, // Defined in ISO/IEC 13818-6
    24:   { type: TYPE_OTHER }, // Defined in ISO/IEC 13818-6
    25:   { type: TYPE_OTHER }, // Defined in ISO/IEC 13818-6
    26:   { type: TYPE_OTHER }, // Defined in ISO/IEC 13818-6
    27:   { type: TYPE_VIDEO }, // MPEG-4_video_descriptor
    28:   { type: TYPE_AUDIO }, // MPEG-4_audio_descriptor
    29:   { type: TYPE_OTHER }, // IOD_descriptor
    30:   { type: TYPE_OTHER }, // SL_descriptor
    31:   { type: TYPE_OTHER }, // FMC_descriptor
    32:   { type: TYPE_OTHER }, // external_ES_ID_descriptor
    33:   { type: TYPE_OTHER }, // MuxCode_descriptor
    34:   { type: TYPE_OTHER }, // FmxBufferSize_descriptor
    35:   { type: TYPE_OTHER }, // multiplexbuffer_descriptor
    36:   { type: TYPE_OTHER }, // content_labeling_descriptor
    37:   { type: TYPE_META  }, // metadata_pointer_descriptor
    38:   { type: TYPE_META  }, // metadata_descriptor
    39:   { type: TYPE_META  }, // metadata_STD_descriptor
    40:   { type: TYPE_VIDEO }, // AVC video descriptor
    41:   { type: TYPE_VIDEO }, // IPMP_descriptor (defined in ISO/IEC 13818-11, MPEG-2 IPMP)
    42:   { type: TYPE_VIDEO }, // AVC timing and HRD descriptor
    43:   { type: TYPE_AUDIO }, // MPEG-2 AAC audio descriptor
    44:   { type: TYPE_OTHER }, // FlexMux_Timing_descriptor
    45:   { type: TYPE_TEXT  }, // MPEG-4_text_descriptor
    46:   { type: TYPE_AUDIO }, // MPEG-4_audio_extension_descriptor
};

var MPEG2_BASE_CLOCK = 27000000; // 27MHz. PCR

// --- class / interfaces ----------------------------------
var MPEG2TSDemuxer = {
    "VERBOSE":  VERBOSE,
    "demux":    MPEG2TSDemuxer_demux, // MPEG2TSDemuxer.demux(source:Uint8Array, cursor:UINT32 = 0):MPEG2TSPacketObject
};

// --- implements ------------------------------------------
function MPEG2TSDemuxer_demux(source,   // @arg Uint8Array - MPEG-2 transport stream (raw level byte stream).
                              cursor) { // @arg UINT32 = 0 - source offset.
                                        // @ret MPEG2TSPacketObject - { PAT, PMT, VIDEO_TS_PACKET, ... }
//{@dev
    if (VERIFY) {
        $valid($type(source, "Uint8Array"),  MPEG2TSDemuxer_demux, "source");
        $valid($type(cursor, "UINT32|omit"), MPEG2TSDemuxer_demux, "cursor");
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
            "VIDEO_PCR":            [], // Video PCR(Program Clock Reference) clock array
        };

    var sourceLength = view.source.length;
    var packetLength = 188; // one packet length

    while (view.cursor < sourceLength) {
        var maybeSyncByte = view.source[view.cursor]; // read a byte. find sync_byte (0x47)

        if (maybeSyncByte === 0x47) { // found sync_byte
            var subview = {
                    source: view.source.subarray(view.cursor, view.cursor + packetLength),
                    cursor: 0
                };

            _dumpTSPacket188bytes(subview.source);

            var header = _readTSPacketHeader(subview); // Object - { hasAdaptationField:Boolean, hasPayload:Boolean, unitStart:Boolean, PID:UINT16, continuity_counter:UINT8 }
            var adaptation_field = { PCR: 0, OPCR: 0 };

            if (header.hasAdaptationField) {
                adaptation_field = _readAdaptationField(subview); // { PCR, OPCR }
            }
            if (header.hasPayload) {
                _readTSPacketPayload(subview, header, adaptation_field, mpeg2ts);
            }
            view.cursor += packetLength;
        } else {
            view.cursor++; // skip unknown byte
        }
    }
    return mpeg2ts;
}

function _readTSPacketHeader(subview) { // @arg Object - subview for read ts packet. length = 188. { source, cursor }
    // T-REC-H.222.0 (P.19) - Table 2-2 Transport packet of this Recommendation | International Standard
    //
    //  |00000000|12344444|44444444|55667777|    bit index field
    //   01000111                             -> 8   0     sync_byte: UINT8 `0x47`
    //            ~                           -> 1   1     transport_error_indicator: Boolean
    //             ~                          -> 1   2     payload_unit_start_indicator: Boolean
    //              ~                         -> 1   3     transport_priority: Boolean
    //               ~~~~~ ~~~~~~~~           -> 13  4     PID: UINT -> Table 2-3 - PID table
    //                              ~~        -> 2   5     transport_scrambling_control: UINT
    //                                ~~      -> 2   6     adaptation_field_control: UINT
    //                                  ~~~~  -> 4   7     continuity_counter:
    //

    var record = _split32(_read4(subview), [8, 1, 1, 1, 13, 2, 2, 4]);
    var afc = record[6]; // afc: adaptation_field_control

    var hasAdaptationField = afc === 0x2 || afc === 0x3;
    var hasPayload         = afc === 0x1 || afc === 0x3;
    var unitStart          = record[2] === 1;
    var PID                = record[4]; // 13bit
    var continuity_counter = record[7]; // 4bit

    return {
        hasAdaptationField: hasAdaptationField,
        hasPayload:         hasPayload,
        unitStart:          unitStart,
        PID:                PID,
        continuity_counter: continuity_counter,
    };
}

function _readTSPacketPayload(subview,          // @arg Object - subview for read ts packet. length = 188. { source, cursor }
                              header,           // @arg Object - { hasAdaptationField:Boolean, hasPayload:Boolean, unitStart:Boolean, PID:UINT16, continuity_counter:UINT8 }
                              adaptation_field, // @arg Object - { PCR, OPCR }
                              mpeg2ts) {        // @arg Object - demux result
    var packetType = "";
    var PID = header.PID;
    var PCR = adaptation_field.PCR;
    var continuity_counter = header.continuity_counter;

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

    switch (packetType) {
    case "PAT":
        // mpeg2ts.PAT = { NET_PID, PMT_PID }
        mpeg2ts["PAT"] = _readPAT(subview, header);
        break;
    case "PMT":
        // mpeg2ts.PMT = { VIDEO_STREAM_PID, AUDIO_STREAM_PID, META_STREAM_PID, VIDEO_CODEC, AUDIO_CODEC, DESCRIPTOR }
        mpeg2ts["PMT"] = _readPMT(subview, header);
        break;
    case "VIDEO":
        if (MPEG2TSDemuxer["VERBOSE"]) {
            console.info("VIDEO PACKET. PID = 0x" + PID.toString(16),
                         "PCR = "  + PCR  + "(" + (PCR  / MPEG2_BASE_CLOCK) + " sec)");
        }
        _storeTSPacketPayload(subview, header, mpeg2ts["VIDEO_TS_PACKET"]);
        _storeContinuityCounter(continuity_counter, header, mpeg2ts["VIDEO_COUNTER"]);
        _storePCR(PCR / MPEG2_BASE_CLOCK, header, mpeg2ts["VIDEO_PCR"]);
        break;
    case "AUDIO":
        if (MPEG2TSDemuxer["VERBOSE"]) {
            console.info("AUDIO PACKET. PID = 0x" + PID.toString(16),
                         "PCR = "  + PCR  + "(" + (PCR  / MPEG2_BASE_CLOCK) + " sec)");
        }
        _storeTSPacketPayload(subview, header, mpeg2ts["AUDIO_TS_PACKET"]);
        _storeContinuityCounter(continuity_counter, header, mpeg2ts["AUDIO_COUNTER"]);
        break;
    case "META":
        break;
    case "NULL":
        break;
    case "USER":
        if (MPEG2TSDemuxer["VERBOSE"]) {
            console.info("USER DEFINED PID: 0x" + PID.toString(16));
        }
        break;
    default:
        console.warn("UNKNOWN PID: 0x" + PID.toString(16));
    }

    function _storeTSPacketPayload(subview, header, target) {
        var payload = subview.source.subarray(subview.cursor);

        if (header.unitStart) {
            target[target.length] = [ payload ];
        } else {
            target[target.length - 1].push( payload );
        }
    }
    function _storeContinuityCounter(continuity_counter, header, target) {
        if (header.unitStart) {
            target[target.length] = [ continuity_counter ];
        } else {
            target[target.length - 1].push( continuity_counter );
        }
    }
    function _storePCR(PCR, header, target) {
        if (header.unitStart) {
            target.push(PCR);
        }
    }
}

function _readAdaptationField(subview) { // @arg Object - { source, cursor }
                                         // @ret - { PCR, OPCR }
    var adaptation_field_length = _read1(subview);
    var adaptation_field_end    = subview.cursor + adaptation_field_length;
//  var private_data_byte = [];
    var PCR  = 0;
    var OPCR = 0;

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
            PCR = _readPCR(subview);  // 6byte, 27MHz
        }
        if (OPCR_flag) {
            OPCR = _readPCR(subview); // 6byte, 27MHz
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
    return { PCR: PCR, OPCR: OPCR };
}

function _readPAT(subview,  // @arg Object - packet subview. { source, cursor }
                  header) { // @arg Object - { hasAdaptationField:Boolean, hasPayload:Boolean, unitStart:Boolean, PID:UINT16, continuity_counter:UINT8 }
                            // @ret Object - { NET_PID, PMT_PID }
                            // @desc T-REC-H.222.0 (P.43) - 2.4.4.3 Program Association Table
    var NET_PID = [];
    var PMT_PID = [];

    if (header.unitStart) {
        subview.cursor++; // skip pointer_field
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
            if (NET_PID.indexOf(pid) < 0) { // avoid duplicate PID
                NET_PID.push(pid);
                if (MPEG2TSDemuxer["VERBOSE"]) {
                    console.info("collect NET_PID: 0x" + pid.toString(16));
                }
            }
        } else {
            if (PMT_PID.indexOf(pid) < 0) { // avoid duplicate PID
                PMT_PID.push(pid);
                if (MPEG2TSDemuxer["VERBOSE"]) {
                    console.info("collect PMT_ID: 0x" + pid.toString(16));
                }
            }
        }
//{@dev
        if (VERIFY) {
            if (filler4 !== 7) { throw new TypeError("BAD_FORMAT filler4: ", filler4); }
        }
//}@dev
    }

//{@dev
    if (VERIFY) {
        var dataEnd = subview.cursor;
        var CRC_32  = _read4(subview);
        var verify  = Hash["CRC"]( subview.source.subarray(offset, dataEnd), Hash["CRC32_MPEG2"] );

        if (CRC_32 !== verify) {
            throw new TypeError("PAT CRC ERROR:" + CRC_32 + ", " + verify);
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

function _readPMT(subview,  // @arg Object - packet subview. { source, cursor }
                  header) { // @arg Object - { hasAdaptationField:Boolean, hasPayload:Boolean, unitStart:Boolean, PID:UINT16, continuity_counter:UINT8 }
                            // @ret Object - { VIDEO_STREAM_PID, AUDIO_STREAM_PID, META_STREAM_PID, VIDEO_CODEC, AUDIO_CODEC, DESCRIPTOR }
                            // @desc T-REC-H.222.0 (P.46) - 2.4.4.8 Program Map Table
    var VIDEO_STREAM_PID = 0;
    var AUDIO_STREAM_PID = 0;
    var META_STREAM_PID  = 0;
    var VIDEO_CODEC      = "";
    var AUDIO_CODEC      = "";
    var DESCRIPTOR       = [];

    if (header.unitStart) {
        subview.cursor++; // skip pointer_field
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

    var descview = null;

    if (program_info_length) {
        descview = {
            source: subview.source.subarray(subview.cursor, subview.cursor + program_info_length),
            cursor: 0,
        };
        DESCRIPTOR.push( _readDescriptor(descview) );
        subview.cursor += descview.source.length;
    }

    while (subview.cursor < section_length) {
        // Table 2-33 - Transport Stream program map section
        //
        // |00011111|11111111|22223333|33333333|   bit index field
        // |~~~                                 ->  3  0     reserved
        // |   ~~~~~ ~~~~~~~~                   -> 13  1     elementary_PID
        // |                  ~~~~              ->  4  2     reserved
        // |                      00~~ ~~~~~~~~ -> 12  3     ES_info_length (12bit -> 10bit)
        //
        var stream_type    = _read1(subview);
        var field4         = _split32(_read4(subview), [3, 13, 4, 12]);
        var filler6        = field4[0]; // `111`
        var elementary_PID = field4[1];
        var filler7        = field4[2]; // `1111`
        var ES_info_length = field4[3]; // 12bit (first two bits of which shall be '00')

//{@dev
        if (VERIFY) {
            if (filler6 !== 0x7) { console.warn("BAD FORMAT filler6: " + filler6); }
            if (filler7 !== 0xf) { console.warn("BAD FORMAT filler7: " + filler7); }
            if (ES_info_length >= 0x400) {
                console.warn("BAD FORMAT ES_info_length: " + ES_info_length);
            }
        }
//}@dev

        // read ES info descripter
        if (ES_info_length) {
            descview = {
                source: subview.source.subarray(subview.cursor, subview.cursor + ES_info_length),
                cursor: 0,
            };
            DESCRIPTOR.push( _readDescriptor(descview) );
            subview.cursor += descview.source.length;
        }

        // (P.47) Table 2-34 Stream type assignments
        if (stream_type >= STREAM_TYPE_START && stream_type <= STREAM_TYPE_END) {
            switch ( STREAM_TYPE[stream_type].type ) { // TYPE_OTHER | TYPE_VIDEO | TYPE_AUDIO | TYPE_META | TYPE_TEXT
            case TYPE_VIDEO:
                VIDEO_STREAM_PID = elementary_PID;
                VIDEO_CODEC      = STREAM_TYPE[stream_type].codec || "";
                if (MPEG2TSDemuxer["VERBOSE"]) {
                    console.log("add VIDEO_STREAM_PID", elementary_PID);
                    console.log("Found Video Stream. stream_type: 0x" + stream_type.toString(16));
                    console.info("Collect VIDEO_STREAM_PID: 0x" + elementary_PID.toString(16));
                }
                break;
            case TYPE_AUDIO:
                AUDIO_STREAM_PID = elementary_PID;
                AUDIO_CODEC      = STREAM_TYPE[stream_type].codec || "";
                if (MPEG2TSDemuxer["VERBOSE"]) {
                    console.log("add AUDIO_STREAM_PID", elementary_PID);
                    console.log("Found Audio Stream. stream_type: 0x" + stream_type.toString(16));
                    console.info("Collect AUDIO_STREAM_PID: 0x" + elementary_PID.toString(16));
                }
                break;
            case TYPE_META:
                META_STREAM_PID = elementary_PID;
                if (MPEG2TSDemuxer["VERBOSE"]) {
                    console.log("add META_STREAM_PID", elementary_PID);
                    console.log("Found Meta Stream. stream_type: 0x" + stream_type.toString(16));
                    console.info("Collect META_STREAM_PID: 0x" + elementary_PID.toString(16));
                }
                break;
            case TYPE_TEXT:
            case TYPE_OTHER:
                break;
            }
        } else if (stream_type > STREAM_TYPE_END && stream_type <= 0x7E) {
            // ITU-T Rec. H.222.0 | ISO/IEC 13818-1 Reserved
            if (MPEG2TSDemuxer["VERBOSE"]) {
                console.log("Reserved Stream. stream_type: 0x" + stream_type.toString(16));
            }
        } else if (stream_type === 0x7F) {
            if (MPEG2TSDemuxer["VERBOSE"]) {
                console.log("IPMP Stream. stream_type: 0x" + stream_type.toString(16));
            }
        } else if (stream_type >= 0x80 && stream_type <= 0xff) {
            // maybe: ID3 tags, etc ...
            if (MPEG2TSDemuxer["VERBOSE"]) {
                console.log("User Private Stream. stream_type: 0x" + stream_type.toString(16));
            }
        }
    }

//{@dev
    if (VERIFY) {
        var dataEnd = subview.cursor;
        var CRC_32  = _read4(subview);
        var verify  = Hash["CRC"]( subview.source.subarray(offset, dataEnd), Hash["CRC32_MPEG2"] );

        if (CRC_32 !== verify) {
            throw new TypeError("PMT CRC ERROR:" + CRC_32 + ", " + verify);
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

function _readDescriptor(desc_view) { // @arg Object - { source, cursor }
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
    var descriptor_tag    = _read1(desc_view); // descriptor_tag
    var descriptor_length = _read1(desc_view); // descriptor_length
    var descriptor_data   = desc_view.source.subarray(desc_view.cursor,
                                                      desc_view.cursor + descriptor_length);
    var descriptor_string = String.fromCharCode.apply(null, descriptor_data);
/*
    var desc_data_view = {
            source: descriptor_data,
            cursor: 0,
        };

    switch (descriptor_tag) {
    case 37: // metadata_pointer_descriptor
        metadata_pointer_descriptor(desc_data_view);
        break;
    case 38: // metadata_descriptor
        metadata_descriptor(desc_data_view);
        break;
    case 46:
        MPEG4_audio_extension_descriptor(desc_data_view);
        break;
    default:
        console.info("UNKNOWN DESCRIPTOR_TAG", descriptor_tag);
    }
 */
    return {
        "descriptor_tag":    descriptor_tag,
        "descriptor_data":   descriptor_data,
        "descriptor_string": descriptor_string,
    };
}

/*
function metadata_pointer_descriptor(desc_data_view) {
    var metadata_application_format  = _read2(desc_data_view); // 0xFFFF
    var metadata_format_identifier_string_1 = "";
    if (metadata_application_format === 0xFFFF) {
        metadata_format_identifier_string_1 = _read4Text(desc_data_view); // "ID3 " (0x49 0x44 0x33 0x20)
    }
    var metadata_format = _read1(desc_data_view); // 0xFF
    var metadata_format_identifier_string_2 = "";
    if (metadata_format === 0xFF) {
        metadata_format_identifier_string_2 = _read4Text(desc_data_view); // "ID3 " (0x49 0x44 0x33 0x20)
    }
    var metadata_service_id          = _read1(desc_data_view); // any ID, typically 0
    var metadata_locator_record_flag = _read1(desc_data_view); // 0
    var MPEG_carriage_flags          = _read1(desc_data_view); // 0
    var reserved                     = _read1(desc_data_view); // 0x1f
    var program_number               = 0;
    if (MPEG_carriage_flags === 0 ||
        MPEG_carriage_flags === 1 ||
        MPEG_carriage_flags === 2) {
        program_number               = _read1(desc_data_view);
    }
}

function metadata_descriptor(desc_data_view) {
    var metadata_application_format  = _read2(desc_data_view); // 0xFFFF
    var metadata_format_identifier_string_1 = "";
    if (metadata_application_format === 0xFFFF) {
        metadata_format_identifier_string_1 = _read4Text(desc_data_view); // "ID3 " (0x49 0x44 0x33 0x20)
    }
    var metadata_format = _read1(desc_data_view); // 0xFF
    var metadata_format_identifier_string_2 = "";
    if (metadata_format === 0xFF) {
        metadata_format_identifier_string_2 = _read4Text(desc_data_view); // "ID3 " (0x49 0x44 0x33 0x20)
    }
    var metadata_service_id          = _read1(desc_data_view); // any ID, typically 0
    var decoder_config_flags         = _read1(desc_data_view);
    var DSM_CC_flag                  = _read1(desc_data_view);
    var reserved                     = _read1(desc_data_view);
}

function MPEG4_video_descripter(desc_data_view) {
    // ISO/IEC 13818-1:2000(E) 2.6.36 MPEG-4 video descriptor

    var visual_profile_and_level = _read1(desc_data_view);
}

function MPEG4_audio_descripter(desc_data_view) {
    // ISO/IEC 13818-1:2000(E) 2.6.38 MPEG-4 audio descriptor

    var audio_profile_and_level = _read1(desc_data_view);

    // ISO/IEC 13818-1:2007
    switch (audio_profile_and_level) {
    case 0x50: // AAC profile, level 1
    case 0x51: // AAC profile, level 2
    case 0x52: // AAC profile, level 4
    case 0x53: // AAC profile, level 5

    case 0x58: // High efficiency AAC profile, level 2
    case 0x59: // High efficiency AAC profile, level 3
    case 0x5A: // High efficiency AAC profile, level 4
    case 0x5B: // High efficiency AAC profile, level 5

    case 0x60: // High efficiency AAC v2 profile, level 2
    case 0x61: // High efficiency AAC v2 profile, level 3
    case 0x62: // High efficiency AAC v2 profile, level 4
    case 0x63: // High efficiency AAC v2 profile, level 5
    }
}

function MPEG4_audio_extension_descriptor(desc_data_view) {
    // ISO/IEC 13818-1:2007 2.6.72 MPEG-4 audio extension descriptor

    // descriptor_tag           8
    // descriptor_length        8
    var field1              = _split8(_read1(desc_data_view), [1, 3, 4]);
    var ASC_flag            = field1[0]; // 1
    var reserved            = field1[1]; // 3
    var num_of_loops        = field1[2]; // 4

    var audioProfileLevelIndication = [];
    for (var i = 0; i < num_of_loops; ++i) {
        audioProfileLevelIndication.push(_read1(desc_data_view)); // 8
    }
    if (ASC_flag === 1) {
        ASC_size = _read1(desc_data_view); // 8
        //audioSpecificConfig();
    }
}
 */

function _readPCR(subview) { // @arg Object - { source, cursor }
                             // @ret Object - { base, extension }
                             // @desc read program clock reference. 27MHz clock.
    // PCR
    //  |00000000|00000000|00000000|00000000|01111112|22222222|    bit index field
    //  |~~~~~~~~ ~~~~~~~~ ~~~~~~~~ ~~~~~~~~|~                  -> 33  0     program_clock_reference_base
    //  |                                   | ~~~~~~            ->  6  1     Reserved
    //  |                                   |       ~ ~~~~~~~~  ->  9  2     program_clock_reference_extension

    // OPCR
    //  |00000000|00000000|00000000|00000000|01111112|22222222|    bit index field
    //  |~~~~~~~~ ~~~~~~~~ ~~~~~~~~ ~~~~~~~~|~                  -> 33  0     original_program_clock_reference_base
    //  |                                   | ~~~~~~            ->  6  1     Reserved
    //  |                                   |       ~ ~~~~~~~~  ->  9  2     original_program_clock_reference_extension
    var u32   = _read4(subview);                      // base(32bit)
    var field = _split16(_read2(subview), [1, 6, 9]); // [base(1bit), Reserved:6, extension:9]
    var base  = u32 * 2 + field[0]; // Number: 33bits
    var extension = field[2]; // 9bit: 0 - 299 (`000000000` - `100101011`)

    // MPEG1 は90kHz のクロックを33bit の値で示していましたが、MPEG2 はその300倍のクロックで動作しています
    // PCR や SCR の値は 33bit + 9bit = 42bit の情報です。これらは33bitと9bitに分けて解釈する必要があります
    // MPEG1 のシステムクロックは、90kHzでしたが、 MPEG2 は 90kHz * 300 の 27MHz で動作します
    // MPEG2 では 0〜299を9bitで表現し、MPEG1で使われていた33bitにこの9bitを加味した合計 42bitで27MHzのクロックを表現しています
    // 下位9bitの値は0〜299までカウントアップし、299の次は0に戻ります。これによりMPEG1の300倍の分解能を実現しています
    // PCR や SCR の値は base(33bit) x 300 + extension(9bit) から求める事ができます

    if (VERIFY) {
        if (extension >= 300) {
            console.warn("PCR Extension value is wrong:", extension);
            extension = 0;
        }
    }
    var result = (base * 300) + extension; // (90Hz * 300) + extension = 27MHz

    return result;
}

/*
function _read4Text(view) { // @ret String
    return String.fromCharCode.apply(null, [
        view.source[view.cursor++],
        view.source[view.cursor++],
        view.source[view.cursor++],
        view.source[view.cursor++]
    ]);
}
 */

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

function _dumpTSPacket188bytes(source) {
    if (MPEG2TSDemuxer["VERBOSE"]) {
        HexDump(source, {
            "title": "_readTSPacket",
            "begin": 0,
            "end": 188,
            "rule": {
                "sync_byte": { "begin": 0, "end": 1, "values": [0x47], "style": "font-weight:bold;color:green" },
                "PID":       { "begin": 1, "end": 3,                   "style": "font-weight:bold;color:red"   },
                "afc":       { "begin": 3, "end": 4,                   "style": "font-weight:bold;color:blue"  }, // adaptation_field_control
            }
        });
    }
}

return MPEG2TSDemuxer; // return entity

});

