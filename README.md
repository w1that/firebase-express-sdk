# Firebase Express SDK

Simplify interaction with Firebase Firestore by using this SDK to easily set up and manage CRUD operations for collections, handle API endpoints, and streamline data retrieval and manipulation in your Express.js projects.

![Uygulama Ekran Görüntüsü](https://i.ibb.co/cXMrpJ1/hero-image.png)


## Quick Start

### Set up an Express server

```bash
mkdir firebase-express-tutorial
cd firebase-express-tutorial
```

```bash
npm init -y
```

Install the dependencies

```bash
npm install express cors body-parser
npm install -D nodemon
```

Install the **Firebase Express SDK**:

```bash
npm install firebase-express-sdk
```
Create a new file named index.js and add the following code:
  
```js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { FirebaseExpressSdk } = require("firebase-express-sdk");

// We will be back to this later
```

### Create a Firebase project

Go to the [Firebase console](https://console.firebase.google.com/) and create a new project.

Add [Cloud Firestore](https://console.firebase.google.com/project/_/firestore) to your project.

**For more details about setting up Cloud Firestore, check out the [official documentation](https://firebase.google.com/docs/firestore/quickstart).**

### Generate a service account

Go to the [service accounts page](https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk) and generate a new private key.

Save the file in your project directory and name it `serviceAccount.json`.

The project directory should look like this:

```bash
.
├── node_modules
├── serviceAccount.json
├── index.js
├── package.json
└── package-lock.json
```

### Initialize the Firebase Express SDK

Add the following code to the `index.js` file:

```js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { FirebaseExpressSdk } = require("firebase-express-sdk");
const serviceAccountFile = require("./serviceAccount.json");

const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());

const collections = {
  users: {
    documentAttributes: ["name", "age", "email"],
  },
};

const firebaseExpressSdk = new FirebaseExpressSdk({
  app, // Express app
  serviceAccountFile, // Firebase service account file
  collections, // Collections to expose,
  port, // Port to listen to (default: 3000)
});

firebaseExpressSdk.addActions([
  {
    collection: "users",
    endpoint: "/api/getUsers",
    request: {
      type: "GET",
    },
  },
  {
    collection: "users",
    endpoint: "/api/addUser",
    request: {
      type: "POST",
    },
  },
]);
```

### Start the server

Add the following script to the `package.json` file:

```json
"scripts": {
  "start": "nodemon index.js"
}
```

Start the server:

```bash
npm start
```

### Test the endpoints and enjoy!

Make a `GET` request to `http://localhost:3000/api/getUsers` and you should get an empty array.

Make a `POST` request to `http://localhost:3000/api/addUser` with the following body:

```json
{
  "name": "John Doe",
  "age": 25,
  "email": "johndoe@john.com"
}
``` 

Make a `GET` request to `http://localhost:3000/api/getUsers` and you should get the following response:

```json
{
  "status": "success",
  "data": [
    {
      "name": "John Doe",
      "age": 25,
      "email": "johndoe@john.com"
    }
  ]
}
```

We encourage you to explore the [Documents section](https://firebase-express-sdk.vercel.app/) for a deeper dive into the various features and functionalities of Firebase Express SDK.

## Contributing

We value your contributions and look forward to working with you to enhance Firebase Express SDK.

To start contributing, take a look at [Contributing guide](https://github.com/w1that/firebase-express-sdk/blob/main/CONTRIBUTING.md)
