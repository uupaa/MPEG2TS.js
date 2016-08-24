// MPEG2TS test

require("../../lib/WebModule.js");

WebModule.VERIFY  = true;
WebModule.VERBOSE = true;
WebModule.PUBLISH = true;

require("../../node_modules/uupaa.typedarray.js/lib/TypedArray.js");
require("../../node_modules/uupaa.aac.js/node_modules/uupaa.bit.js/lib/Bit.js");
require("../../node_modules/uupaa.aac.js/node_modules/uupaa.bit.js/lib/BitView.js");
require("../../node_modules/uupaa.aac.js/node_modules/uupaa.hash.js/lib/Hash.js");
require("../../node_modules/uupaa.aac.js/lib/AAC.js");
require("../../node_modules/uupaa.aac.js/lib/ADTS.js");
require("../../node_modules/uupaa.base64.js/lib/Base64.js");
require("../../node_modules/uupaa.mpeg4bytestream.js/node_modules/uupaa.hexdump.js/lib/HexDump.js");
require("../../node_modules/uupaa.mpeg4bytestream.js/node_modules/uupaa.nalunit.js/lib/NALUnitType.js");
require("../../node_modules/uupaa.mpeg4bytestream.js/node_modules/uupaa.nalunit.js/lib/NALUnitParameterSet.js");
require("../../node_modules/uupaa.mpeg4bytestream.js/node_modules/uupaa.nalunit.js/lib/NALUnitEBSP.js");
require("../../node_modules/uupaa.mpeg4bytestream.js/node_modules/uupaa.nalunit.js/lib/NALUnitAUD.js");
require("../../node_modules/uupaa.mpeg4bytestream.js/node_modules/uupaa.nalunit.js/lib/NALUnitSPS.js");
require("../../node_modules/uupaa.mpeg4bytestream.js/node_modules/uupaa.nalunit.js/lib/NALUnitPPS.js");
require("../../node_modules/uupaa.mpeg4bytestream.js/node_modules/uupaa.nalunit.js/lib/NALUnitSEI.js");
require("../../node_modules/uupaa.mpeg4bytestream.js/node_modules/uupaa.nalunit.js/lib/NALUnitIDR.js");
require("../../node_modules/uupaa.mpeg4bytestream.js/node_modules/uupaa.nalunit.js/lib/NALUnitNON_IDR.js");
require("../../node_modules/uupaa.mpeg4bytestream.js/node_modules/uupaa.nalunit.js/lib/NALUnit.js");
require("../../node_modules/uupaa.mpeg4bytestream.js/lib/MPEG4ByteStream.js");
require("../../node_modules/uupaa.fileloader.js/node_modules/uupaa.uri.js/lib/URI.js");
require("../../node_modules/uupaa.fileloader.js/node_modules/uupaa.uri.js/lib/URISearchParams.js");
require("../../node_modules/uupaa.fileloader.js/lib/FileLoader.js");
require("../../node_modules/uupaa.fileloader.js/lib/FileLoaderQueue.js");
require("../wmtools.js");
require("../../lib/MPEG2TSNALUnit.js");
require("../../lib/MPEG2TSDemuxer.js");
require("../../lib/MPEG2TS.js");
require("../../release/MPEG2TS.n.min.js");
require("../testcase.js");

