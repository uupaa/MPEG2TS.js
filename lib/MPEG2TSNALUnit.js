(function moduleExporter(name, closure) {
"use strict";

var entity = GLOBAL["WebModule"]["exports"](name, closure);

if (typeof module !== "undefined") {
    module["exports"] = entity;
}
return entity;

})("MPEG2TSNALUnit", function moduleClosure(global, WebModule, VERIFY, VERBOSE) {
"use strict";

// --- technical terms / data structure --------------------
// --- dependency modules ----------------------------------
// --- import / local extract functions --------------------
// --- define / local variables ----------------------------
// --- class / interfaces ----------------------------------
var MPEG2TSNALUnit = {
    "VERBOSE":      VERBOSE,
    "toNALUnit":    MPEG2TS_toNALUnit, // MPEG2TS.toNALUnit(tsPackets:MPEG2TSPacketUint8ArrayArray):NALUnitObjectArray - [ NALUnitObject, ... ]
};

// --- implements ------------------------------------------
function MPEG2TS_toNALUnit(pes) { // @arg MPEG2TSPESPacketArray
                                  // @ret NALUnitObjectArray - [{ index, nal_ref_idc, nal_unit_type, DTS, PTS, data }, ... ]
                                  // @desc PESPacket -> ByteStream -> NALUnit
    var result = [];
    // --- slide buffer ---
    var a       = 0;    // byteStream[current - 3] byte
    var b       = 0;    // byteStream[current - 2] byte
    var c       = 0;    // byteStream[current - 1] byte
    var d       = 0;    // byteStream[current] byte
    var remain  = 0;    // buffer cursor(remain)
    var start   = -1;   // NALUnit start position
    var end     = 0;    // NALUnit end position
    var data    = null; // NALUnitHeader + EBSP

    for (var i = 0, iz = pes.length; i < iz; ++i) {
        var PTS     = pes[i]["PTS"];
        var DTS     = pes[i]["DTS"];
        var buffer  = pes[i]["PAYLOAD"];
        var bufferLength = buffer.length;
        var cursor  = 0;  // buffer cursor

        while (cursor < bufferLength) {
            a = b;
            b = c;
            c = d;
            d = buffer[cursor++] || 0;

            if (b === 0x00 && c === 0x00 && d === 0x01) {
                // Start code is [00 00 00 01] or [00 00 01]
                //
                //  +----------------+-------------------------------++----------------+----------------+
                //  |  00? 00 00 01  | xx xx xx xx xx xx xx xx xx xx ||  00? 00 00 01  | xx xx xx xx xx | ...
                //  +----------------+-------------------------------++----------------+----------------+
                //   <--start code--> <---- NALUnitHeader + EBSP --->
                //                    ^                             ^
                //                  start                          end
                //
                if (remain || start >= 0) {
                    end = cursor - ((a === 0x00) ? 4 : 3); // (00 00 00 01) or (00 00 01)
                    if (remain) {
                        data = _concat( pes[i - 1]["PAYLOAD"].subarray(remain), buffer.subarray(0, end) );
                    } else {
                        data = buffer.subarray(start, end);
                    }
                    result.push( _createNALUnitObject( result.length, DTS, PTS, data ) );
                    remain = 0;
                }
                start = cursor;
            }
        }
        remain = start;
    }
    if (remain) { // add last NALUnit
        result.push( _createNALUnitObject( result.length, DTS, PTS, buffer.subarray(remain) ) );
    }
    return result;
}

function _createNALUnitObject(index, DTS, PTS, data) {
    return {
        "index":            index,
        "nal_ref_idc":      (data[0] & 0x60) >> 5,
        "nal_unit_type":    data[0]  & 0x1F,
        "DTS":              DTS,
        "PTS":              PTS,
        "data":             data, // NALUnitHeader + EBSP
    };
}

function _concat(a, b) {
    var result = new Uint8Array(a.length + b.length);

    result.set(a, 0);
    result.set(b, a.length);
    return result;
}

return MPEG2TSNALUnit; // return entity

});

