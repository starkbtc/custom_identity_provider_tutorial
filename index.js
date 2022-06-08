const express = require("express");
const axios = require("axios"); //could be any other package capable of http calls

//database configuration
const { JsonDB } = require("node-json-db");
const { Config } = require("node-json-db/dist/lib/JsonDBConfig");

var db = new JsonDB(new Config("myDataBase", true));

const app = express();

//liveChat configuration
var licenseId = "13346586";
var clientId = "e4c0736561254a3ea0d071dba2700a08";

app.get("/getFreshToken/:username", async (req, res) => {
  // STEP 1. CONFIGURE HTTPS CALL
  const config = {
    method: "POST",
    url: "https://accounts.livechat.com/customer/token",
    headers: {
      "Content-Type": "application/json",
      origin: "https://www.placki.com", //an URL whitelisted in our app settings
    },
    data: {
      grant_type: "cookie",
      response_type: "token",
      client_id: clientId,
      license_id: parseInt(licenseId),
    },
  };

  try {
    //STEP 2. MAKE THE CALL
    var response = await axios(config);

    //STEP 3. FIND COOKIES IN THE RESPONSE
    var __lc_cid = response.headers["set-cookie"].find((el) =>
      el.includes("__lc_cid")
    );

    var __lc_cst = response.headers["set-cookie"].find((el) =>
      el.includes("__lc_cst")
    );

    //STEP 4. SAVE THE COOKIES TO OUR DATABASE
    db.push("/" + req.params.username, {
      username: req.params.username,
      __lc_cid: __lc_cid,
      __lc_cst: __lc_cst,
    });

    //STEP 5. SEND TOKEN OBJECT AS A RESPONSE
    res.send(response.data);

  } catch (err) {

    res.send("error fetching customer token");

  }
});

app.get("/getToken/:username", async (req, res) => {
  try {
    //STEP 1. FIND IF THE USER IS ALREADY REGISTERED
    var userObject = db.getData("/" + req.params.username);

    const config = {
      method: "POST",
      url: "https://accounts.livechat.com/customer/token",
      headers: {
        "Content-Type": "application/json",
        origin: "https://www.placki.com", //an URL whitelisted in our app settings
        //STEP 2. ATTACH THE COOKIES TO THE REQUEST
        cookie: userObject ? [userObject.__lc_cid, userObject.__lc_cst] : null,
      },

      data: {
        grant_type: "cookie",
        response_type: "token",
        client_id: clientId,
        license_id: parseInt(licenseId),
      },
    };



    //STEP 3. MAKE THE REQUEST CALL
    var response = await axios(config);

    var __lc_cid = response.headers["set-cookie"].find((el) =>
      el.includes("__lc_cid")
    );

    var __lc_cst = response.headers["set-cookie"].find((el) =>
      el.includes("__lc_cst")
    );
   
    
    //STEP 4. UPDATE DATABASE WITH NEWLY OBTAINED DATA
    db.push("/" + req.params.username, {
      username: req.params.username,
      __lc_cid: __lc_cid,
      __lc_cst: __lc_cst,
    });

    //STEP 5. FORWARD THE RESPONSE

    res.send(response.data);

  } catch (err) {

    console.log(err.message);

  }
});

app.get("/hasToken/:username", async (req, res) => {
   //IF RECORD FOR THE USER EXISTS -> RETURN TRUE
  try {
    await db.getData("/" + req.params.username);
    res.send(true);
  } catch {
    res.send(false);
  }
});

app.get("/invalidate/:username", (req, res) => {
   //REMOVE THE USER RECORD
  try {
    db.delete("/" + req.params.username);
    res.send(true);
  } catch {
    res.send("errors when removong the user");
  }
});

var server = app.listen(process.env.port || 3000, () => {
  var host = server.address().address;
  var port = server.address().port;
  console.log("Example app listening at http://%s:%s", host, port);
});
