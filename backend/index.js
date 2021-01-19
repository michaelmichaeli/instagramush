// dependencies
const express = require("express");
const admin = require("firebase-admin");
let inspect = require("util").inspect;
let Busboy = require("busboy");
let path = require("path");
let os = require("os");
let fs = require("fs");
let UUID = require("uuid-v4")

// config express
const app = express();

// config firebase
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "instagramush-157b6.appspot.com"
});

const db = admin.firestore();
let bucket = admin.storage().bucket();

//endpoint - get posts
app.get("/posts", (request, response) => {
  response.set("Access-Control-Allow-Origin", "*");  // preventing CORS warnning

  let posts = [];
  db.collection("posts")
    .orderBy("date", "desc") // sorting for showing latest posts first
    .get()
    .then(snapshot => {
      snapshot.forEach(doc => posts.push(doc.data()));
      response.send(posts);
    });
});

//endpoint - create a post
app.post("/createPost", (request, response) => {
  response.set("Access-Control-Allow-Origin", "*"); // preventing CORS warnning

  let uuid = UUID()

  var busboy = new Busboy({ headers: request.headers });

  let fields = {};
  let fileDate = {}

  busboy.on("file", function(fieldname, file, filename, encoding, mimetype) {
    console.log("File [" + fieldname + "]: filename: " + filename + ", encoding: " + encoding + ", mimetype: " + mimetype);
    let filepath = path.join(os.tmpdir(), filename)
    file.pipe(fs.createWriteStream(filepath))
    fileData = { filepath, mimetype }    
  });
  busboy.on("field", function(
    fieldname,
    val,
    fieldnameTruncated,
    valTruncated,
    encoding,
    mimetype
  ) {
    console.log("Field [" + fieldname + "]: value: " + inspect(val));
    fields[fieldname] = val;
  });

  busboy.on("finish", function () {

    bucket.upload(fileData.filepath, {
      uploadType: 'media', metadata: {
        metadata: {
          contentType: fileData.mimetype,
          firebaseStorageDownloadTokens: uuid
        }
      }
    },
      (err, uploadedFile) => {
        if (!err) {
          createDocument(uploadedFile)
        }
      }
    )

    function createDocument(uploadedFile) {

      db.collection("posts")
      .doc(fields.id)
      .set({
        id: fields.id,
        caption: fields.caption,
        location: fields.location,
        date: parseInt(fields.date),
        imageUrl: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${uploadedFile.name}?alt=media&token=${uuid}`
      })
        .then(() => response.send('Post added:, ' + fields.id))
    }

  });
  request.pipe(busboy);
});

// listen
app.listen(process.env.PORT || 3000);
