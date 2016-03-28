// MPEG2TS test

require("../../lib/WebModule.js");

WebModule.VERIFY  = true;
WebModule.VERBOSE = true;
WebModule.PUBLISH = true;

require("../../node_modules/uupaa.bit.js/lib/Bit.js");
require("../../node_modules/uupaa.bit.js/lib/BitView.js");
require("../../node_modules/uupaa.hash.js/lib/Hash.js");
require("../../node_modules/uupaa.hexdump.js/lib/HexDump.js");
require("../../node_modules/uupaa.fileloader.js/lib/FileLoader.js");
require("../wmtools.js");
require("../../lib/MPEG2TSParser.js");
require("../../lib/MPEG2TS.js");
require("../../release/MPEG2TS.n.min.js");
require("../testcase.js");

