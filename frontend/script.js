///1. GRAB THE USERNAME
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
var user = urlParams.get('user') || Date.now().toString(36) + Math.random().toString(36).substring(2)

///2. ADD THE CUSTOM IDENTITY PROVIDER 
 window.__lc.custom_identity_provider =  () => {
    return {
        getToken: () => getToken(),
        getFreshToken:() => getFreshToken(),
        hasToken:() => hasToken(),
        invalidate:() => Promise.resolve(),
    }
 }
 

 var baseAPI = "https://custom-identity-provider.herokuapp.com/"
 
 ///3. CONNECT THE CIP METHODS TO OUR API
 
 const getToken =  async () => {
   var apiURL = baseAPI + "getToken/"
   var tokenObject =  await fetch(apiURL + user).then(res => {
     if(res.status<400)
     return res.json()
     else return null
   }
  )
   console.log("getToken", tokenObject)
   return tokenObject ? tokenObject : false
 }
 
 const getFreshToken =  async () => {
    var apiURL = baseAPI + "getFreshToken/"
   var tokenObject =  await fetch(apiURL + user).then(res => {
     if(res.status<400)
     return res.json()
     else return null
   })
   return tokenObject ? tokenObject : false
 }
 
 const hasToken = async () => {
    var apiURL = baseAPI + "hasToken/"
   var response =  await fetch(apiURL + user).then(res => res.json())
   response = JSON.stringify(response)
   return (response === "true")
 }