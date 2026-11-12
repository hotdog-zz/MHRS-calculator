'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),P=require('../dist/probability.js'),index=require('../dist/probability/index.json');
let book;function load(group){book??=P.prepareCodebook(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.resolve(__dirname,'../dist/probability',index.codebook.file)))));return P.unpack(zlib.gunzipSync(fs.readFileSync(path.resolve(__dirname,'../dist/probability',group+index.extension))),book,group);}
module.exports={load,index};
