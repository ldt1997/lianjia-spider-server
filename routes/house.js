var express = require("express");
var router = express.Router();
var bodyParser = require("body-parser");
var eventproxy = require("eventproxy"); //流程控制
var ep = eventproxy();
var MongoClient = require("mongodb").MongoClient;
var url = "mongodb://localhost:27017/";
// var url = "mongodb://127.0.0.1:27017/"; // 上传到阿里云改为127.0.0.1(不知道不改行不行)
const housesColName = "houses"; //表名

// 创建 application/x-www-form-urlencoded 编码解析
var urlencodedParser = bodyParser.urlencoded({ extended: false });

/****爬虫服务器后台接口*****/

/****house页面操作*****/
/**获取区块数据**/
router.post("/house/getPosition", urlencodedParser, function(req, res) {
  console.log("获取区块数据");
  //请求成功
  if (req.body) {
    const colName = "position";
    // 连接数据库
    MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      var dbo = db.db("lianjiaSpider"); //数据库名
      dbo
        .collection(colName)
        .find()
        .toArray(function(err, result) {
          if (err) throw err;
          ep.emit("getPositionData", result);
        });
    });
    ep.all("getPositionData", function(data1) {
      res.send({
        data: {
          list: data1
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
        .collection(housesColName)
        .aggregate([
          {
            $match: {
              position: colName
            }
          },
          { $group: { _id: null, count: { $sum: 1 } } }
        ])
        .toArray(function(err, result) {
          if (err) throw err;
          ep.emit("getHouseNum", result);
        });
      dbo
        .collection(housesColName)
        .aggregate([
          { $match: { unitPrice: { $ne: NaN }, position: colName } },
          { $group: { _id: null, count: { $avg: "$unitPrice" } } }
        ])
        .toArray(function(err, result) {
          if (err) throw err;
          ep.emit("getAvgUnitPrice", result);
        });
      dbo
        .collection(housesColName)
        .aggregate([
          { $match: { listedPrice: { $ne: NaN }, position: colName } },
          { $group: { _id: null, count: { $avg: "$listedPrice" } } }
        ])
        .toArray(function(err, result) {
          if (err) throw err;
          ep.emit("getListedPrice", result);
        });
      dbo
        .collection(housesColName)
        .aggregate([
          { $match: { totalPrice: { $ne: NaN }, position: colName } },
          { $group: { _id: null, count: { $avg: "$totalPrice" } } }
        ])
        .toArray(function(err, result) {
          if (err) throw err;
          ep.emit("getTotalPrice", result);
          db.close();
        });
      dbo
        .collection(housesColName)
        .aggregate([
          { $match: { size: { $ne: NaN }, position: colName } },
          { $group: { _id: null, count: { $avg: "$size" } } }
        ])
        .toArray(function(err, result) {
          if (err) throw err;
          ep.emit("getAvgSize", result);
          db.close();
        });
      dbo
        .collection(housesColName)
        .aggregate([
          { $match: { dealPeriod: { $ne: NaN }, position: colName } },
          { $group: { _id: null, count: { $avg: "$dealPeriod" } } }
        ])
        .toArray(function(err, result) {
          if (err) throw err;
          ep.emit("getDealPeriod", result);
          db.close();
        });
    });

    ep.all(
      "getHouseNum",
      "getAvgUnitPrice",
      "getListedPrice",
      "getTotalPrice",
      "getAvgSize",
      "getDealPeriod",
      function(data1, data2, data3, data4, data5, data6) {
        res.send({
          data: {
            houseNum: data1[0].count ? data1[0].count : null, //房源数量(int)
            avgUnitPrice: data2[0].count ? data2[0].count : null, //平均单价(float)
            avgListedPrice: data3[0].count ? data3[0].count : null, //平均挂牌总价(float)
            avgTotalPrice: data4[0].count ? data4[0].count : null, //平均成交总价(float)
            avgSize: data5[0].count ? data5[0].count : null,
            avgDealPeriod: data6[0].count ? data6[0].count : null
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
        .collection(housesColName)
        .aggregate([
          { $match: { position: colName } },
          { $group: { _id: null, count: { $sum: 1 } } }
        ])
        .toArray(function(err, result) {
          if (err) throw err;
          ep.emit("getHouseNum", result);
        });
      //获取表格数据
      dbo
        .collection(housesColName)
        .aggregate([{ $match: { position: colName } }])
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
  console.log("获取饼图数据", req.body.position, req.body.type);
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
            .collection(housesColName)
            .aggregate([
              {
                $match: {
                  position: colName,
                  elevator: { $ne: NaN }
                }
              },
              { $group: { _id: "$elevator", count: { $sum: 1 } } },
              { $project: { item: "$_id", count: 1, _id: 0 } }
            ])
            .toArray(function(err, result) {
              if (err) throw err;
              // ep.emit("getDonutData", result);
              res.send({
                data: {
                  filterData: result[0] ? result : null
                },
                errorCode: "0", //0表示成功
                errorMsg: ""
              });
              db.close();
            });
          break;
        case 2:
          dbo
            .collection(housesColName)
            .aggregate([
              {
                $match: {
                  position: colName,
                  name: { $ne: NaN },
                  layout: { $regex: /\d室\d厅/ }
                }
              },
              { $group: { _id: "$layout", count: { $sum: 1 } } },
              { $project: { item: "$_id", count: 1, _id: 0 } }
            ])
            .toArray(function(err, result) {
              if (err) throw err;
              // ep.emit("getDonutData", result);
              res.send({
                data: {
                  filterData: result[0] ? result : null
                },
                errorCode: "0", //0表示成功
                errorMsg: ""
              });
              db.close();
            });
          break;
        case 3:
          dbo
            .collection(housesColName)
            .aggregate([
              {
                $match: {
                  position: colName,
                  $or: [
                    {
                      toward: "东"
                    },
                    {
                      toward: "南"
                    },
                    {
                      toward: "西"
                    },
                    {
                      toward: "北"
                    },
                    {
                      toward: "东北"
                    },
                    {
                      toward: "西北"
                    },
                    {
                      toward: "东南"
                    },
                    {
                      toward: "西南"
                    }
                  ]
                }
              },
              { $group: { _id: "$toward", count: { $sum: 1 } } },
              { $project: { item: "$_id", count: 1, _id: 0 } }
            ])
            .toArray(function(err, result) {
              if (err) throw err;
              // ep.emit("getDonutData", result);
              res.send({
                data: {
                  filterData: result[0] ? result : null
                },
                errorCode: "0", //0表示成功
                errorMsg: ""
              });
              db.close();
            });
          break;
        case 4:
          dbo
            .collection(housesColName)
            .aggregate([
              {
                $match: {
                  position: colName,
                  decoration: { $ne: NaN }
                }
              },
              { $group: { _id: "$decoration", count: { $sum: 1 } } },
              { $project: { item: "$_id", count: 1, _id: 0 } }
            ])
            .toArray(function(err, result) {
              if (err) throw err;
              // ep.emit("getDonutData", result);
              res.send({
                data: {
                  filterData: result[0] ? result : null
                },
                errorCode: "0", //0表示成功
                errorMsg: ""
              });
              db.close();
            });
          break;
        default:
          dbo
            .collection(housesColName)
            .aggregate([
              {
                $match: {
                  position: colName,
                  elevator: { $ne: NaN }
                }
              },
              { $group: { _id: "$elevator", count: { $sum: 1 } } },
              { $project: { item: "$_id", count: 1, _id: 0 } }
            ])
            .toArray(function(err, result) {
              if (err) throw err;
              // ep.emit("getDonutData", result);
              res.send({
                data: {
                  filterData: result[0] ? result : null
                },
                errorCode: "0", //0表示成功
                errorMsg: ""
              });
              db.close();
            });
      }
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
        .collection(housesColName)
        .aggregate([
          {
            $match: {
              position: colName,
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
        .collection(housesColName)
        .aggregate([
          {
            $match: {
              position: colName,
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
        .collection(housesColName)
        .aggregate([
          {
            $match: {
              position: colName,
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
        .collection(housesColName)
        .aggregate([
          {
            $match: {
              position: colName,
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
        .collection(housesColName)
        .aggregate([
          {
            $match: {
              position: colName,
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
        .collection(housesColName)
        .aggregate([
          {
            $match: {
              position: colName,
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
          "250万-300万",
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
        .collection(housesColName)
        .aggregate([
          {
            $match: {
              position: colName,
              totalPrice: { $ne: NaN }
            }
          }
        ])
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

/**获取房价（总价）随面积变化趋势数据**/
router.post("/house/searchCurvedLineChartData", urlencodedParser, function(
  req,
  res
) {
  console.log("获取房价（总价）随面积变化趋势数据", req.body.position);
  //请求成功
  if (req.body && req.body.position) {
    const colName = req.body.position; // 表名
    // 连接数据库
    MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      var dbo = db.db("lianjiaSpider"); //数据库名
      dbo
        .collection(housesColName)
        .aggregate([
          {
            $match: {
              position: colName,
              totalPrice: { $ne: NaN },
              listedPrice: { $ne: NaN },
              size: { $ne: NaN }
            }
          },
          { $project: { item: "$size", listedPrice: 1, totalPrice: 1 } }
        ])
        .limit(500)
        .toArray(function(err, result) {
          if (err) throw err;
          ep.emit("getCurvedLineChartData", result);
        });
    });
    ep.all("getCurvedLineChartData", function(data1) {
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

/**获取装修与平均单价关系图数据**/
router.post("/house/searchDecorPriceData", urlencodedParser, function(
  req,
  res
) {
  console.log("获取装修与平均成交价关系图数据", req.body.position);
  //请求成功
  if (req.body && req.body.position) {
    const colName = req.body.position; // 表名
    // 连接数据库
    MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      var dbo = db.db("lianjiaSpider"); //数据库名
      dbo
        .collection(housesColName)
        .aggregate([
          {
            $match: {
              position: colName,
              unitPrice: { $ne: NaN }
            }
          },
          { $group: { _id: "$decoration", count: { $avg: "$unitPrice" } } },
          { $project: { item: "$_id", count: 1, _id: 0 } }
        ])
        .toArray(function(err, result) {
          if (err) throw err;
          ep.emit("getDecorPriceData", result);
        });
    });
    ep.all("getDecorPriceData", function(data1) {
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

/**获取装修与价格箱型图数据**/
router.post("/house/searchDecorBoxData", urlencodedParser, function(req, res) {
  console.log("获取装修与价格箱型图数据", req.body.position);
  //请求成功
  if (req.body && req.body.position) {
    const colName = req.body.position; // 表名
    // 连接数据库
    MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      var dbo = db.db("lianjiaSpider"); //数据库名
      dbo
        .collection(housesColName)
        .aggregate([
          {
            $match: {
              position: colName,
              unitPrice: { $ne: NaN, $ne: 0 }
            }
          },
          {
            $group: {
              _id: "$decoration",
              low: { $min: "$unitPrice" },
              high: { $max: "$unitPrice" },
              array: { $push: "$unitPrice" }
            }
          },
          { $project: { x: "$_id", low: 1, high: 1, array: 1, _id: 0 } }
        ])
        .toArray(function(err, result) {
          if (err) throw err;
          const temArr = result.map(item => ({
            x: item.x,
            low: item.low,
            high: item.high,
            q3: item.array.sort()[parseInt((item.array.length / 4) * 3)],
            q1: item.array.sort()[parseInt(item.array.length / 4)],
            median:
              item.array.length % 2 === 0
                ? (item.array.sort()[parseInt(item.array.length / 2)] +
                    item.array.sort()[parseInt(item.array.length / 2 + 1)]) /
                  2
                : item.array.sort()[parseInt((item.array.length + 1) / 2)]
          }));
          ep.emit("getDecorBoxData1", temArr);
        });
    });
    ep.all("getDecorBoxData1", function(data) {
      res.send({
        data: {
          filterData: data[0] ? data : null
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
