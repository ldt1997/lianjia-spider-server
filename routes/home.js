var express = require("express");
var router = express.Router();
var bodyParser = require("body-parser");
var eventproxy = require("eventproxy"); //流程控制
var ep = eventproxy();
var MongoClient = require("mongodb").MongoClient;
// var url = "mongodb://localhost:27017/";
var url = "mongodb://127.0.0.1:27017/"; // 上传到阿里云改为127.0.0.1(不知道不改行不行)

// 创建 application/x-www-form-urlencoded 编码解析
var urlencodedParser = bodyParser.urlencoded({ extended: false });
// 各区块表名
const colNameArr = [
  "baiyun",
  "conghua",
  "haizhu",
  "huadou",
  "huangpugz",
  "liwan",
  "nansha",
  "panyu",
  "tianhe",
  "yuexiu",
  "zengcheng"
];

// 统计不同种类标签的数量
function Classify(data) {
  var resArr = [];
  if (!data) return false;
  var nameContainer = {}; // 针对键name进行归类的容器
  data.forEach(i => {
    i.forEach(item => {
      nameContainer[item._id] = nameContainer[item._id] || [];
      nameContainer[item._id].push(item);
    });
  });
  // 统计不同种类标签的数量
  var keyName = Object.keys(nameContainer);
  keyName.forEach(nameItem => {
    let count = 0;
    nameContainer[nameItem].forEach(item => {
      count += item.count; // 条目计算总数
    });
    resArr.push({ item: nameItem, count: count });
  });
  return resArr;
}
/****爬虫服务器后台接口*****/

/****home页面操作*****/
/**获取概览数据**/
router.post("/home/searchOverviewData", urlencodedParser, function(req, res) {
  console.log("获取概览数据");
  //请求成功
  if (req.body) {
    // 连接数据库
    MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      var dbo = db.db("lianjiaSpider"); //数据库名

      // 对于要查询的每个集合
      for (let i in colNameArr) {
        const temObj = {};
        temObj.position = colNameArr[i];
        dbo
          .collection(colNameArr[i])
          .aggregate([{ $group: { _id: null, count: { $sum: 1 } } }])
          .toArray(function(err, result) {
            if (err) throw err;
            temObj.houseNum = result[0].count ? result[0].count : 0;
            ep.emit("getHouseNum", result);
          });
        ep.after("getHouseNum", 1, function(data) {
          dbo
            .collection(colNameArr[i])
            .aggregate([
              { $match: { unitPrice: { $ne: NaN } } },
              { $group: { _id: null, count: { $sum: "$unitPrice" } } }
            ])
            .toArray(function(err, result) {
              if (err) throw err;
              temObj.unitPrice = result[0].count ? result[0].count : 0;
              ep.emit("getUnitPrice", temObj);
            });
        });
        ep.after("getUnitPrice", 1, function(data) {
          dbo
            .collection(colNameArr[i])
            .aggregate([
              { $match: { listedPrice: { $ne: NaN } } },
              { $group: { _id: null, count: { $sum: "$listedPrice" } } }
            ])
            .toArray(function(err, result) {
              if (err) throw err;
              temObj.listedPrice = result[0].count ? result[0].count : 0;
              ep.emit("getListedPrice", temObj);
            });
        });
        ep.after("getListedPrice", 1, function(data) {
          dbo
            .collection(colNameArr[i])
            .aggregate([
              { $match: { totalPrice: { $ne: NaN } } },
              { $group: { _id: null, count: { $sum: "$totalPrice" } } }
            ])
            .toArray(function(err, result) {
              if (err) throw err;
              temObj.totalPrice = result[0].count ? result[0].count : 0;
              ep.emit("getTotalPrice", temObj);
            });
        });
      }
    });
    ep.after("getTotalPrice", colNameArr.length, function(data) {
      let houseNum = 0,
        avgUnitPrice = 0,
        avgListedPrice = 0,
        avgTotalPrice = 0;
      for (let i = 0; i < data.length; i++) {
        houseNum += data[i].houseNum;
        avgUnitPrice += data[i].unitPrice;
        avgListedPrice += data[i].listedPrice;
        avgTotalPrice += data[i].totalPrice;
      }
      avgUnitPrice /= houseNum;
      avgListedPrice /= houseNum;
      avgTotalPrice /= houseNum;
      res.send({
        data: {
          houseNum: houseNum, //房源数量(int)
          avgUnitPrice: avgUnitPrice, //平均单价(float)
          avgListedPrice: avgListedPrice, //平均挂牌总价(float)
          avgTotalPrice: avgTotalPrice //平均成交总价(float)
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
router.post("/home/searchDonutData", urlencodedParser, function(req, res) {
  console.log("获取饼图数据", req.body.type);
  //请求成功
  if (req.body && req.body.type && req.body.type >= 1 && req.body.type <= 4) {
    // 连接数据库
    MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      var dbo = db.db("lianjiaSpider"); //数据库名
      switch (req.body.type) {
        // 1按地区房源数量
        case 1:
          for (let i in colNameArr) {
            const temObj = {};
            temObj.item = colNameArr[i];
            dbo
              .collection(colNameArr[i])
              .aggregate([{ $group: { _id: null, count: { $sum: 1 } } }])
              .toArray(function(err, result) {
                if (err) throw err;
                temObj.count = result[0].count ? result[0].count : 0;
                ep.emit("getDonutData", temObj);
              });
          }
          db.close();
          break;
        //2按户型
        case 2:
          for (let i in colNameArr) {
            dbo
              .collection(colNameArr[i])
              .aggregate([
                {
                  $match: {
                    name: { $ne: NaN },
                    layout: { $regex: /\d室\d厅/ }
                  }
                },
                { $group: { _id: "$layout", count: { $sum: 1 } } }
              ])
              .toArray(function(err, result) {
                if (err) throw err;
                ep.emit("getDonutData", result);
              });
          }
          db.close();
          break;
        //3按价格区间
        case 3:
          for (let i in colNameArr) {
            const temArr = [];
            // <=100w
            dbo
              .collection(colNameArr[i])
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
                if (result[0]) result[0]._id = "100万以下";
                temArr.push(
                  result[0] ? result[0] : { _id: "100万以下", count: 0 }
                );
              });
            //100-150w
            dbo
              .collection(colNameArr[i])
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
                if (result[0]) result[0]._id = "100万-150万";
                temArr.push(
                  result[0] ? result[0] : { _id: "100万-150万", count: 0 }
                );
              });
            // 150-200w
            dbo
              .collection(colNameArr[i])
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
                if (result[0]) result[0]._id = "150万-200万";
                temArr.push(
                  result[0] ? result[0] : { _id: "150万-200万", count: 0 }
                );
              });
            //200-250w
            dbo
              .collection(colNameArr[i])
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
                if (result[0]) result[0]._id = "200万-250万";
                temArr.push(
                  result[0] ? result[0] : { _id: "200万-250万", count: 0 }
                );
              });
            //250-300w
            dbo
              .collection(colNameArr[i])
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
                if (result[0]) result[0]._id = "250万-300万";
                temArr.push(
                  result[0] ? result[0] : { _id: "250万-300万", count: 0 }
                );
              });
            //>=300w
            dbo
              .collection(colNameArr[i])
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
                if (result[0]) result[0]._id = "大于300万";
                temArr.push(
                  result[0] ? result[0] : { _id: "大于300万", count: 0 }
                );
                ep.emit("getDonutData", temArr);
              });
          }
          db.close();
          break;
        //4按面积
        case 4:
          for (let i in colNameArr) {
            const temArr = [];
            // <=40
            dbo
              .collection(colNameArr[i])
              .aggregate([
                {
                  $match: {
                    size: { $ne: NaN, $lte: 40 }
                  }
                },
                { $group: { _id: null, count: { $sum: 1 } } }
              ])
              .toArray(function(err, result) {
                if (err) throw err;
                if (result[0]) result[0]._id = "40平以下";
                temArr.push(
                  result[0] ? result[0] : { _id: "40平以下", count: 0 }
                );
              });
            //40-60
            dbo
              .collection(colNameArr[i])
              .aggregate([
                {
                  $match: {
                    size: { $gt: 40, $lte: 60 }
                  }
                },
                { $group: { _id: null, count: { $sum: 1 } } }
              ])
              .toArray(function(err, result) {
                if (err) throw err;
                if (result[0]) result[0]._id = "40平-60平";
                temArr.push(
                  result[0] ? result[0] : { _id: "40平-60平", count: 0 }
                );
              });
            // 60-80
            dbo
              .collection(colNameArr[i])
              .aggregate([
                {
                  $match: {
                    size: { $gt: 60, $lte: 80 }
                  }
                },
                { $group: { _id: null, count: { $sum: 1 } } }
              ])
              .toArray(function(err, result) {
                if (err) throw err;
                if (result[0]) result[0]._id = "60平-80平";
                temArr.push(
                  result[0] ? result[0] : { _id: "60平-80平", count: 0 }
                );
              });
            //80-100
            dbo
              .collection(colNameArr[i])
              .aggregate([
                {
                  $match: {
                    size: { $gt: 80, $lte: 100 }
                  }
                },
                { $group: { _id: null, count: { $sum: 1 } } }
              ])
              .toArray(function(err, result) {
                if (err) throw err;
                if (result[0]) result[0]._id = "80平-100平";
                temArr.push(
                  result[0] ? result[0] : { _id: "80平-100平", count: 0 }
                );
              });
            //100-120
            dbo
              .collection(colNameArr[i])
              .aggregate([
                {
                  $match: {
                    size: { $gt: 100, $lte: 120 }
                  }
                },
                { $group: { _id: null, count: { $sum: 1 } } }
              ])
              .toArray(function(err, result) {
                if (err) throw err;
                if (result[0]) result[0]._id = "100平-120平";
                temArr.push(
                  result[0] ? result[0] : { _id: "100平-120平", count: 0 }
                );
              });
            //>=120
            dbo
              .collection(colNameArr[i])
              .aggregate([
                {
                  $match: {
                    size: { $ne: NaN, $gte: 120 }
                  }
                },
                { $group: { _id: null, count: { $sum: 1 } } }
              ])
              .toArray(function(err, result) {
                if (err) throw err;
                if (result[0]) result[0]._id = "大于120平";
                temArr.push(
                  result[0] ? result[0] : { _id: "大于120平", count: 0 }
                );
                ep.emit("getDonutData", temArr);
              });
          }
          db.close();
          break;
        default:
          for (let i = 0; i < colNameArr.length; i++) {
            ep.emit("getDonutData", []);
          }
      }
    });
    ep.after("getDonutData", colNameArr.length, function(data) {
      var resArr = []; //最终数据
      if (req.body.type !== 2 && req.body.type !== 3 && req.body.type !== 4) {
        resArr = data.slice();
      } else {
        resArr = Classify(data);
      }
      res.send({
        data: {
          filterData: resArr
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

/**获取矩形树图数据**/
router.post("/home/searchTreemapData", urlencodedParser, function(req, res) {
  console.log("获取矩形树图数据");
  //请求成功
  if (req.body) {
    // 连接数据库
    MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      var dbo = db.db("lianjiaSpider"); //数据库名
      for (let i in colNameArr) {
        const temObj = {};
        temObj.name = colNameArr[i];
        dbo
          .collection(colNameArr[i])
          .aggregate([
            { $match: { unitPrice: { $ne: NaN } } },
            { $group: { _id: null, count: { $avg: "$unitPrice" } } }
          ])
          .toArray(function(err, result) {
            if (err) throw err;
            temObj.value = result[0].count ? result[0].count : 0;
            ep.emit("getTreemapData", temObj);
          });
      }
      db.close();
    });
    ep.after("getTreemapData", colNameArr.length, function(data) {
      res.send({
        data: {
          filterData: {
            name: "root",
            children: data
          }
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

/**获取堆叠条形图数据**/
router.post("/home/searchStackedData", urlencodedParser, function(req, res) {
  console.log("获取堆叠条形图数据");
  //请求成功
  if (req.body) {
    // 连接数据库
    MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      var dbo = db.db("lianjiaSpider"); //数据库名
      for (let i in colNameArr) {
        const temObj = {};
        temObj.state = colNameArr[i];
        // <=100w
        dbo
          .collection(colNameArr[i])
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
            temObj.lowwerThan100w = result[0] ? result[0].count : 0;
          });
        //100-150w
        dbo
          .collection(colNameArr[i])
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
            temObj.between100_150w = result[0] ? result[0].count : 0;
          });
        // 150-200w
        dbo
          .collection(colNameArr[i])
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
            temObj.between150_200w = result[0] ? result[0].count : 0;
          });
        //200-250w
        dbo
          .collection(colNameArr[i])
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
            temObj.between200_250w = result[0] ? result[0].count : 0;
          });
        //250-300w
        dbo
          .collection(colNameArr[i])
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
            temObj.between250_300w = result[0] ? result[0].count : 0;
          });
        //>=300w
        dbo
          .collection(colNameArr[i])
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
            temObj.higherThan300w = result[0] ? result[0].count : 0;
            ep.emit("getStackedData", temObj);
          });
      }
      db.close();
    });
    ep.after("getStackedData", colNameArr.length, function(data) {
      res.send({
        data: {
          filterData: data.map(item => {
            var obj = {
              State: item.state,
              "<100万": item.lowwerThan100w,
              "100-150万": item.between100_150w,
              "150-200万": item.between150_200w,
              "200-250万": item.between200_250w,
              "250-300万": item.between250_300w,
              ">300万": item.higherThan300w
            };
            return obj;
          })
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

/**获取折线图数据 **/
router.post("/home/searchLineChartData", urlencodedParser, function(req, res) {
  console.log("获取折线图数据");
  //请求成功
  if (req.body) {
    // 连接数据库
    MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      var dbo = db.db("lianjiaSpider"); //数据库名
      for (let i in colNameArr) {
        dbo
          .collection(colNameArr[i])
          .aggregate([
            { $project: { new_time_stamp: { $substr: ["$dealDate", 0, 7] } } },
            { $group: { _id: "$new_time_stamp", count: { $sum: 1 } } }
          ])
          .toArray(function(err, result) {
            if (err) throw err;
            ep.emit("getLineChartData", result);
          });
      }
      db.close();
    });
    ep.after("getLineChartData", colNameArr.length, function(data) {
      res.send({
        data: {
          filterData: Classify(data)
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

/****测试用 home页面获取饼图数据的分解接口 ****/
/**获取饼图数据-房源数量**/
router.post("/home/searchDonutData1", urlencodedParser, function(req, res) {
  console.log("获取饼图数据", req.body.type);
  //请求成功
  if (req.body && req.body.type && req.body.type >= 1 && req.body.type <= 4) {
    // 连接数据库
    MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      var dbo = db.db("lianjiaSpider"); //数据库名
      switch (req.body.type) {
        // 1按地区房源数量
        case 1:
          for (let i in colNameArr) {
            const temObj = {};
            temObj.item = colNameArr[i];
            dbo
              .collection(colNameArr[i])
              .aggregate([{ $group: { _id: null, count: { $sum: 1 } } }])
              .toArray(function(err, result) {
                if (err) throw err;
                temObj.count = result[0].count ? result[0].count : 0;
                ep.emit("getDonutData1", temObj);
              });
          }
          db.close();
          break;
        default:
          for (let i = 0; i < colNameArr.length; i++) {
            ep.emit("getDonutData1", []);
          }
      }
    });
    ep.after("getDonutData1", colNameArr.length, function(data) {
      var resArr = []; //最终数据
      resArr = data.slice();
      res.send({
        data: {
          filterData: resArr
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

/**获取饼图数据-户型**/
router.post("/home/searchDonutData2", urlencodedParser, function(req, res) {
  console.log("获取饼图数据", req.body.type);
  //请求成功
  if (req.body && req.body.type && req.body.type >= 1 && req.body.type <= 4) {
    // 连接数据库
    MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      var dbo = db.db("lianjiaSpider"); //数据库名
      switch (req.body.type) {
        //2按户型
        case 2:
          for (let i in colNameArr) {
            dbo
              .collection(colNameArr[i])
              .aggregate([
                {
                  $match: {
                    name: { $ne: NaN },
                    layout: { $regex: /\d室\d厅/ }
                  }
                },
                { $group: { _id: "$layout", count: { $sum: 1 } } }
              ])
              .toArray(function(err, result) {
                if (err) throw err;
                ep.emit("getDonutData2", result);
              });
          }
          db.close();
          break;
        default:
          for (let i = 0; i < colNameArr.length; i++) {
            ep.emit("getDonutData2", []);
          }
      }
    });
    ep.after("getDonutData2", colNameArr.length, function(data) {
      var resArr = []; //最终数据
      if (req.body.type !== 2 && req.body.type !== 3 && req.body.type !== 4) {
        resArr = data.slice();
      } else {
        resArr = Classify(data);
      }
      res.send({
        data: {
          filterData: resArr
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

/**获取饼图数据-价格**/
router.post("/home/searchDonutData3", urlencodedParser, function(req, res) {
  console.log("获取饼图数据", req.body.type);
  //请求成功
  if (req.body && req.body.type && req.body.type >= 1 && req.body.type <= 4) {
    // 连接数据库
    MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      var dbo = db.db("lianjiaSpider"); //数据库名
      switch (req.body.type) {
        //3按价格区间
        case 3:
          for (let i in colNameArr) {
            const temArr = [];
            // <=100w
            dbo
              .collection(colNameArr[i])
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
                if (result[0]) result[0]._id = "100万以下";
                temArr.push(
                  result[0] ? result[0] : { _id: "100万以下", count: 0 }
                );
              });
            //100-150w
            dbo
              .collection(colNameArr[i])
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
                if (result[0]) result[0]._id = "100万-150万";
                temArr.push(
                  result[0] ? result[0] : { _id: "100万-150万", count: 0 }
                );
              });
            // 150-200w
            dbo
              .collection(colNameArr[i])
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
                if (result[0]) result[0]._id = "150万-200万";
                temArr.push(
                  result[0] ? result[0] : { _id: "150万-200万", count: 0 }
                );
              });
            //200-250w
            dbo
              .collection(colNameArr[i])
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
                if (result[0]) result[0]._id = "200万-250万";
                temArr.push(
                  result[0] ? result[0] : { _id: "200万-250万", count: 0 }
                );
              });
            //250-300w
            dbo
              .collection(colNameArr[i])
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
                if (result[0]) result[0]._id = "250万-300万";
                temArr.push(
                  result[0] ? result[0] : { _id: "250万-300万", count: 0 }
                );
              });
            //>=300w
            dbo
              .collection(colNameArr[i])
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
                if (result[0]) result[0]._id = "大于300万";
                temArr.push(
                  result[0] ? result[0] : { _id: "大于300万", count: 0 }
                );
                ep.emit("getDonutData3", temArr);
              });
          }
          db.close();
          break;
        default:
          for (let i = 0; i < colNameArr.length; i++) {
            ep.emit("getDonutData3", []);
          }
      }
    });
    ep.after("getDonutData3", colNameArr.length, function(data) {
      var resArr = []; //最终数据
      if (req.body.type !== 2 && req.body.type !== 3 && req.body.type !== 4) {
        resArr = data.slice();
      } else {
        resArr = Classify(data);
      }
      res.send({
        data: {
          filterData: resArr
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

/**获取饼图数据-面积**/
router.post("/home/searchDonutData4", urlencodedParser, function(req, res) {
  console.log("获取饼图数据", req.body.type);
  //请求成功
  if (req.body && req.body.type && req.body.type >= 1 && req.body.type <= 4) {
    // 连接数据库
    MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      var dbo = db.db("lianjiaSpider"); //数据库名
      switch (req.body.type) {
        //4按面积
        case 4:
          for (let i in colNameArr) {
            const temArr = [];
            // <=40
            dbo
              .collection(colNameArr[i])
              .aggregate([
                {
                  $match: {
                    size: { $ne: NaN, $lte: 40 }
                  }
                },
                { $group: { _id: null, count: { $sum: 1 } } }
              ])
              .toArray(function(err, result) {
                if (err) throw err;
                if (result[0]) result[0]._id = "40平以下";
                temArr.push(
                  result[0] ? result[0] : { _id: "40平以下", count: 0 }
                );
              });
            //40-60
            dbo
              .collection(colNameArr[i])
              .aggregate([
                {
                  $match: {
                    size: { $gt: 40, $lte: 60 }
                  }
                },
                { $group: { _id: null, count: { $sum: 1 } } }
              ])
              .toArray(function(err, result) {
                if (err) throw err;
                if (result[0]) result[0]._id = "40平-60平";
                temArr.push(
                  result[0] ? result[0] : { _id: "40平-60平", count: 0 }
                );
              });
            // 60-80
            dbo
              .collection(colNameArr[i])
              .aggregate([
                {
                  $match: {
                    size: { $gt: 60, $lte: 80 }
                  }
                },
                { $group: { _id: null, count: { $sum: 1 } } }
              ])
              .toArray(function(err, result) {
                if (err) throw err;
                if (result[0]) result[0]._id = "60平-80平";
                temArr.push(
                  result[0] ? result[0] : { _id: "60平-80平", count: 0 }
                );
              });
            //80-100
            dbo
              .collection(colNameArr[i])
              .aggregate([
                {
                  $match: {
                    size: { $gt: 80, $lte: 100 }
                  }
                },
                { $group: { _id: null, count: { $sum: 1 } } }
              ])
              .toArray(function(err, result) {
                if (err) throw err;
                if (result[0]) result[0]._id = "80平-100平";
                temArr.push(
                  result[0] ? result[0] : { _id: "80平-100平", count: 0 }
                );
              });
            //100-120
            dbo
              .collection(colNameArr[i])
              .aggregate([
                {
                  $match: {
                    size: { $gt: 100, $lte: 120 }
                  }
                },
                { $group: { _id: null, count: { $sum: 1 } } }
              ])
              .toArray(function(err, result) {
                if (err) throw err;
                if (result[0]) result[0]._id = "100平-120平";
                temArr.push(
                  result[0] ? result[0] : { _id: "100平-120平", count: 0 }
                );
              });
            //>=120
            dbo
              .collection(colNameArr[i])
              .aggregate([
                {
                  $match: {
                    size: { $ne: NaN, $gte: 120 }
                  }
                },
                { $group: { _id: null, count: { $sum: 1 } } }
              ])
              .toArray(function(err, result) {
                if (err) throw err;
                if (result[0]) result[0]._id = "大于120平";
                temArr.push(
                  result[0] ? result[0] : { _id: "大于120平", count: 0 }
                );
                ep.emit("getDonutData4", temArr);
              });
          }
          db.close();
          break;
        default:
          for (let i = 0; i < colNameArr.length; i++) {
            ep.emit("getDonutData4", []);
          }
      }
    });
    ep.after("getDonutData4", colNameArr.length, function(data) {
      var resArr = []; //最终数据
      if (req.body.type !== 2 && req.body.type !== 3 && req.body.type !== 4) {
        resArr = data.slice();
      } else {
        resArr = Classify(data);
      }
      res.send({
        data: {
          filterData: resArr
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
