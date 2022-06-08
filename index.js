const express = require("express");
const axios = require("axios"); //could be any other package capable of http calls
const cors = require('cors');

//database configuration
const { JsonDB } = require("node-json-db");
const { Config } = require("node-json-db/dist/lib/JsonDBConfig");

var db = new JsonDB(new Config("myDataBase", true));

const app = express();
app.use(cors())

//liveChat configuration
var licenseId = parseInt("13346586");
var clientId = "e4c0736561254a3ea0d071dba2700a08";

app.get("/getToken/:username", async (req, res) => {
   var getUserData  = () => {
      try {
         //STEP 1. FIND IF THE USER IS ALREADY REGISTERED
         return db.getData("/" + req.params.username);
         
       } catch (err) {
         console.log(err.message);
         return null
       }
   }

   var userObject = getUserData()
   if(userObject) res.send(userObject)
   else res.redirect('/getFreshToken/'+ req.params.username)
});

app.get("/getFreshToken/:username", async (req, res) => {
  
   var getUserData  = () => {
      try {
         //STEP 1. FIND IF THE USER IS ALREADY REGISTERED
         return db.getData("/" + req.params.username);
         
       } catch (err) {
         console.log(err.message);
         return null
       }
   }

   var userObject = getUserData()

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
     license_id:licenseId,
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
 var token = {}
 token.creationDate = Date.now()
 token.licenseId = licenseId
 token.entityId = response.data.entity_id
 token.expiresIn = response.data.expires_in
 token.tokenType = response.data.token_type
 token.accessToken = response.data.accessToken
 token.username =  req.params.username
 token.__lc_cid = __lc_cid
 token.__lc_cst = __lc_cst
 db.push("/" + req.params.username, token);

 //STEP 5. FORWARD THE RESPONSE

 res.json(token);
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
    res.send("errors when removing the user");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Our app is running on port ${ PORT }`);
});
