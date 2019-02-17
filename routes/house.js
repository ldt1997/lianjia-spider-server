var express = require("express");
var router = express.Router();
var bodyParser = require("body-parser");
var eventproxy = require("eventproxy"); //流程控制
var ep = eventproxy();
var MongoClient = require("mongodb").MongoClient;
var url = "mongodb://localhost:27017/";

// 创建 application/x-www-form-urlencoded 编码解析
var urlencodedParser = bodyParser.urlencoded({ extended: false });

/****爬虫服务器后台接口*****/

/****house页面操作*****/
/**获取概览数据**/
router.post("/house/searchOverviewData", urlencodedParser, function(req, res) {
  console.log("获取概览数据", req.body.position);
  //请求成功
  if (req.body && req.body.position) {
    const colName = req.body.position;
    // 连接数据库
    MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      var dbo = db.db("lianjiaSpider"); //数据库名
      dbo
        .collection(colName)
        .aggregate([{ $group: { _id: null, count: { $sum: 1 } } }])
        .toArray(function(err, result) {
          if (err) throw err;
          ep.emit("getHouseNum", result);
        });
      dbo
        .collection(colName)
        .aggregate([
          { $match: { unitPrice: { $ne: NaN } } },
          { $group: { _id: null, count: { $avg: "$unitPrice" } } }
        ])
        .toArray(function(err, result) {
          if (err) throw err;
          ep.emit("getAvgUnitPrice", result);
        });
      dbo
        .collection(colName)
        .aggregate([
          { $match: { listedPrice: { $ne: NaN } } },
          { $group: { _id: null, count: { $avg: "$listedPrice" } } }
        ])
        .toArray(function(err, result) {
          if (err) throw err;
          ep.emit("getListedPrice", result);
        });
      dbo
        .collection(colName)
        .aggregate([
          { $match: { totalPrice: { $ne: NaN } } },
          { $group: { _id: null, count: { $avg: "$totalPrice" } } }
        ])
        .toArray(function(err, result) {
          if (err) throw err;
          ep.emit("getTotalPrice", result);
          db.close();
        });
    });
    ep.all(
      "getHouseNum",
      "getAvgUnitPrice",
      "getListedPrice",
      "getTotalPrice",
      function(data1, data2, data3, data4) {
        res.send({
          data: {
            houseNum: data1[0].count ? data1[0].count : null, //房源数量(int)
            avgUnitPrice: data2[0].count ? data2[0].count : null, //平均单价(float)
            avgListedPrice: data3[0].count ? data3[0].count : null, //平均挂牌总价(float)
            avgTotalPrice: data4[0].count ? data4[0].count : null //平均成交总价(float)
          },
          errorCode: "0", //0表示成功
          errorMsg: ""
        });
      }
    );
  }
  //请求失败
  else {
    res.send({
      data: {},
      errorCode: "1", //0表示成功
      errorMsg: "请求失败"
    });
  }
});

/**获取表格数据**/
router.post("/house/searchTableData", urlencodedParser, function(req, res) {
  console.log("获取表格数据", req.body.position);
  //请求成功
  if (req.body && req.body.position) {
    const colName = req.body.position; // 表名
    const { currentPage = 1 } = req.body; // 当前页数(默认第一页)
    const { pageSize = 10 } = req.body; //页数显示数据条数（默认10条）
    const skipNum = (currentPage - 1) * pageSize; //跳过的数据条数
    // 连接数据库
    MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      var dbo = db.db("lianjiaSpider"); //数据库名
      //获取房源总数
      dbo
        .collection(colName)
        .aggregate([{ $group: { _id: null, count: { $sum: 1 } } }])
        .toArray(function(err, result) {
          if (err) throw err;
          ep.emit("getHouseNum", result);
        });
      //获取表格数据
      dbo
        .collection(colName)
        .find()
        .skip(skipNum)
        .limit(pageSize)
        .toArray(function(err, result) {
          if (err) throw err;
          ep.emit("getTableData", result);
          db.close();
        });
    });
    ep.all("getHouseNum", "getTableData", function(data1, data2) {
      res.send({
        data: {
          houseNum: data1[0].count ? data1[0].count : null, //房源数量(int)
          houseList: data2[0] ? data2 : [] //表格数据(float)
        },
        errorCode: "0", //0表示成功
        errorMsg: ""
      });
    });
  }
  //请求失败
  else {
    res.send({
      data: {},
      errorCode: "1", //0表示成功
      errorMsg: "请求失败"
    });
  }
});

/**获取饼图数据**/
router.post("/house/searchDonutData", urlencodedParser, function(req, res) {
  console.log("获取饼图数据", req.body.position);
  //请求成功
  if (req.body && req.body.position && req.body.type) {
    const colName = req.body.position;
    // 连接数据库
    MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      var dbo = db.db("lianjiaSpider"); //数据库名
      switch (req.body.type) {
        case 1:
          dbo
            .collection(colName)
            .aggregate([
              { $match: { name: { $ne: NaN }, layout: { $ne: NaN } } },
              { $group: { _id: "$name", count: { $sum: 1 } } }
            ])
            .toArray(function(err, result) {
              if (err) throw err;
              ep.emit("getDonutData", result);
              db.close();
            });
          break;
        case 2:
          dbo
            .collection(colName)
            .aggregate([
              {
                $match: {
                  name: { $ne: NaN },
                  layout: { $ne: NaN, $ne: "车位" }
                }
              },
              { $group: { _id: "$layout", count: { $sum: 1 } } }
            ])
            .toArray(function(err, result) {
              if (err) throw err;
              ep.emit("getDonutData", result);
              db.close();
            });
          break;
        default:
          dbo
            .collection(colName)
            .aggregate([
              { $match: { name: { $ne: NaN }, layout: { $ne: NaN } } },
              { $group: { _id: "$name", count: { $sum: 1 } } }
            ])
            .toArray(function(err, result) {
              if (err) throw err;
              ep.emit("getDonutData", result);
              db.close();
            });
      }
    });
    ep.all("getDonutData", function(data1) {
      res.send({
        data: {
          filterData: data1[0] ? data1 : null
        },
        errorCode: "0", //0表示成功
        errorMsg: ""
      });
    });
  }
  //请求失败
  else {
    res.send({
      data: {},
      errorCode: "1", //0表示成功
      errorMsg: "请求失败"
    });
  }
});

/**获取柱状图数据**/
router.post("/house/searchBarChartData", urlencodedParser, function(req, res) {
  console.log("获取价格区间数据", req.body.position);
  //请求成功
  if (req.body && req.body.position) {
    const colName = req.body.position;
    const temArr = [];
    // 连接数据库
    MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      var dbo = db.db("lianjiaSpider"); //数据库名
      // <=100w
      dbo
        .collection(colName)
        .aggregate([
          {
            $match: {
              totalPrice: { $ne: NaN, $lte: 100 }
            }
          },
          { $group: { _id: null, count: { $sum: 1 } } }
        ])
        .toArray(function(err, result) {
          if (err) throw err;
          temArr.push(result[0] ? result[0] : { count: 0 });
          ep.emit("getBarData1", result);
        });
      // 100w-150w
      dbo
        .collection(colName)
        .aggregate([
          {
            $match: {
              totalPrice: { $gt: 100, $lte: 150 }
            }
          },
          { $group: { _id: null, count: { $sum: 1 } } }
        ])
        .toArray(function(err, result) {
          if (err) throw err;
          temArr.push(result[0] ? result[0] : { count: 0 });
          ep.emit("getBarData2", result);
        });
      // 150-200w
      dbo
        .collection(colName)
        .aggregate([
          {
            $match: {
              totalPrice: { $gt: 150, $lte: 200 }
            }
          },
          { $group: { _id: null, count: { $sum: 1 } } }
        ])
        .toArray(function(err, result) {
          if (err) throw err;
          temArr.push(result[0] ? result[0] : { count: 0 });
          ep.emit("getBarData3", result);
        });
      // 200-250w
      dbo
        .collection(colName)
        .aggregate([
          {
            $match: {
              totalPrice: { $gt: 200, $lte: 250 }
            }
          },
          { $group: { _id: null, count: { $sum: 1 } } }
        ])
        .toArray(function(err, result) {
          if (err) throw err;
          temArr.push(result[0] ? result[0] : { count: 0 });
          ep.emit("getBarData4", result);
        });
      // 250-300w
      dbo
        .collection(colName)
        .aggregate([
          {
            $match: {
              totalPrice: { $gt: 250, $lte: 300 }
            }
          },
          { $group: { _id: null, count: { $sum: 1 } } }
        ])
        .toArray(function(err, result) {
          if (err) throw err;
          temArr.push(result[0] ? result[0] : { count: 0 });
          ep.emit("getBarData5", result);
        });
      // >=300w
      dbo
        .collection(colName)
        .aggregate([
          {
            $match: {
              totalPrice: { $ne: NaN, $gte: 300 }
            }
          },
          { $group: { _id: null, count: { $sum: 1 } } }
        ])
        .toArray(function(err, result) {
          if (err) throw err;
          temArr.push(result[0] ? result[0] : { count: 0 });
          ep.emit("getBarData6", result);
        });
    });

    ep.all(
      "getBarData1",
      "getBarData2",
      "getBarData3",
      "getBarData4",
      "getBarData5",
      "getBarData6",
      function(data1, data2, data3, data4, data5, data6) {
        const tags = [
          "100万以下",
          "100万-150万",
          "150万-200万",
          "200万-250万",
          "250万-3000万",
          "300万以上"
        ];
        for (let i = 0; i < temArr.length; i++) {
          temArr[i].item = tags[i];
        }
        res.send({
          data: {
            filterData: temArr[0] ? temArr : null //房源数量(int)
          },
          errorCode: "0", //0表示成功
          errorMsg: ""
        });
      }
    );
  }
  //请求失败
  else {
    res.send({
      data: {},
      errorCode: "1", //0表示成功
      errorMsg: "请求失败"
    });
  }
});

/**获取排名数据（成交总价）**/
router.post("/house/searchRankData", urlencodedParser, function(req, res) {
  console.log("获取排名数据", req.body.position);
  //请求成功
  if (req.body && req.body.position) {
    const colName = req.body.position; // 表名
    // 连接数据库
    MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      var dbo = db.db("lianjiaSpider"); //数据库名
      //获取房源总数
      dbo
        .collection(colName)
        .find({ totalPrice: { $ne: NaN } })
        .sort({ totalPrice: -1 })
        .limit(10)
        .toArray(function(err, result) {
          if (err) throw err;
          ep.emit("getRankData", result);
          db.close();
        });
    });
    ep.all("getRankData", function(data1) {
      res.send({
        data: {
          filterData: data1[0] ? data1 : null //rank
        },
        errorCode: "0", //0表示成功
        errorMsg: ""
      });
    });
  }
  //请求失败
  else {
    res.send({
      data: {},
      errorCode: "1", //0表示成功
      errorMsg: "请求失败"
    });
  }
});

module.exports = router;
