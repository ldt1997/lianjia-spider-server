var express = require("express");
var app = express();
var bodyParser = require("body-parser");
var homeRouter = require("../routes/home");
var houseRouter = require("../routes/house");

//设置中间件读取请求中json数据
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

//调用router中间件
app.use("/", houseRouter);
app.use("/", homeRouter);

// 上传到阿里云改为0.0.0.0
// var server = app.listen(8090, "0.0.0.0", function() {
var server = app.listen(8090, function() {
  var host = server.address().address;
  var port = server.address().port;

  console.log("爬虫后台，访问地址为 http://%s:%s", host, port);
});
