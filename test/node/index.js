// MPEG2TS test

require("../../lib/WebModule.js");

WebModule.verify  = true;
WebModule.verbose = true;
WebModule.publish = true;

require("../../node_modules/uupaa.bit.js/lib/Bit.js");
require("../../node_modules/uupaa.bit.js/lib/BitView.js");
require("../../node_modules/uupaa.hash.js/lib/Hash.js");
require("../../node_modules/uupaa.hexdump.js/lib/HexDump.js");
require("../../node_modules/uupaa.typedarray.js/lib/TypedArray.js");
require("../wmtools.js");
require("../../lib/MPEG2TSParser.js");
require("../../lib/MPEG2TS.js");
require("../../release/MPEG2TS.n.min.js");
require("../testcase.js");

