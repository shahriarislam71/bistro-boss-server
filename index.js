const express = require('express')
const cors = require('cors')
jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.Payment_STRIPE_GATEWAY)
const nodemailer = require("nodemailer");
const mg = require('nodemailer-mailgun-transport');
const app = express()
const port = process.env.PORT || 5000

// middlewires
app.use(cors())
app.use(express.json())


// let transporter = nodemailer.createTransport({
//   host: 'smtp.sendgrid.net',
//   port: 587,
//   auth: {
//       user: "apikey",
//       pass: process.env.SENDGRID_API_KEY
//   }
// })

const auth = {
  auth: {
    api_key: process.env.PRIVATE_API_KEY,
    domain: process.env.MAILGUN_DOMAIN
  }
}

const transporter = nodemailer.createTransport(mg(auth));

// email varification
const sendEmail = (email) =>{
  transporter.sendMail({
    from: "shahriar.islam.rafi@g.bracu.ac.bd", // verified sender email
    to: "shahriarislamrafi71@gmail.com", // recipient email
    subject: "Test message subject", // Subject line
    text: "Hello world!", // plain text body
    html: "<b>Your order is successful!</b>", // html body
  }, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}

// jwt verification
const verifyjwt = (req, res, next) => {
  const authorization = req.headers.authorization
  if (!authorization) {
    return res.status(401).send({ error: true, message: "Unathorized action" })
  }
  console.log('authorization : ', authorization)
  const token = authorization.split(' ')[1]
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: "Unauthorized Access" })
    }
    req.decoded = decoded
    next()
  })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xq01pu7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    

    const menusCollection = client.db('bistro-DB').collection('menu')
    const reviewsCollection = client.db('bistro-DB').collection('review')
    const cartCollection = client.db('bistro-DB').collection('carts')
    const usersCollection = client.db('bistro-DB').collection('user')
    const paymentCollection = client.db('bistro-DB').collection('payment')

    // for jwt 
    app.post('/jwt', (req, res) => {
      const user = req.body
      // console.log('jwt user : ',user)
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token })
    })

    // verifyusers role 
    const verifyUserRole = async (req, res, next) => {
      const email = req.decoded.email
      const query = { emailFieldValue: email }
      const result = await usersCollection.findOne(query)
      if (result?.role !== 'admin') {
        return res.status(403).send({ error: true, message: "unathorized access" })
      }
      next()
    }

    // for the menu part 
    app.get('/menu', async (req, res) => {
      const result = await menusCollection.find().toArray()
      res.send(result)
    })

    app.post('/menu', verifyjwt, verifyUserRole, async (req, res) => {
      const query = req.body
      const result = await menusCollection.insertOne(query)
      res.send(result)
    })

    // app.get(`/menu/:id`,async(req,res)=>{
    //   const query = {_id : (req.params.id)}
    //   const result = await menusCollection.findOne(query)
    //   res.send(result)
    // })

    app.delete('/menu/:id', verifyjwt, verifyUserRole, async (req, res) => {
      // console.log(req.params.id)
      // eikhane query te amra 'new ObjectId' use kori nai karon mongoDB te amra data manually rakhchilam and rakhar somoy id ta delete kore rakhi nai tai mongodb ObjectId keyword ta id r sathe add kore nai. tai next time jakhon data rakhbo takhon id ta delete kore rakhbo.
      const query = { _id: (req.params.id) }
      const result = await menusCollection.deleteOne(query)
      res.send(result)
    })

    // for the review part 
    app.get('/review', async (req, res) => {
      const result = await reviewsCollection.find().toArray()
      res.send(result)
    })


    // inserted data for the cartCollection ( for the order)


    // Amra oishob linkei jwt token diye secure korbo, jei pagegula amra userke dekhte dibo na that means jeisokol page visit korte gele user ke login korte hoi oishob pagegula te amra jwt token use korbo.baki page er khettre kora lagbe na.for example, menu route er get method e amader jwt verification lagbe na karon ei menur data dekhte hole ekjon userke login korte hobe na.jwt token diye verify sudu get method ei na jwt amra post method eo use kori.
    app.get('/carts', verifyjwt, async (req, res) => {
      const email = req.query.email
      // console.log('email',email)

      const decodedEmail = req.decoded.email
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: "forbidden access" })
      }

      const query = { email: email }
      const result = await cartCollection.find(query).toArray()
      res.send(result)
    })

    app.post('/carts', async (req, res) => {
      const item = req.body
      // console.log(item)
      const result = await cartCollection.insertOne(item)
      res.send(result)
    })

    app.delete('/carts/:id', async (req, res) => {
      // console.log(req.params.id)
      const query = { _id: new ObjectId(req.params.id) }
      const result = await cartCollection.deleteOne(query)
      res.send(result)
    })



    // for users data 


    app.get('/user', verifyjwt, verifyUserRole, async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })

    app.post('/user', async (req, res) => {
      const userData = req.body
      // console.log(userData)
      const query = { emailFieldValue: userData.emailFieldValue }
      const existinguser = await usersCollection.findOne(query)
      // console.log('existing user',existinguser)
      if (existinguser) {
        return res.send({ message: "email already exists" })
      }
      const result = await usersCollection.insertOne(userData)
      res.send(result)
    })

    app.get('/user/admin/:email', verifyjwt, async (req, res) => {
      const email = req.params.email
      console.log('dashboard email :', email)
      console.log('varify dashbord email : ', req.decoded.email)

      if (req.decoded.email !== email) {
        return res.send({ admin: false })
      }

      const query = { emailFieldValue: email }
      console.log(query)
      const user = await usersCollection.findOne(query)
      console.log(user)
      const result = { admin: (user?.role === 'admin') ? true : false }
      console.log('Admin-result', result)
      res.send(result)
    })

    app.patch('/user/admin/:id', async (req, res) => {
      const id = req.params.id
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc)
      res.send(result)
    })

    // stripe payment intent 
    app.post('/create-payment-intent', verifyjwt, async (req, res) => {
      const { price } = req.body
      console.log('users', req.body)
      const amount = Math.round(price * 100)
      console.log(amount)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      })
      console.log('paymentIntent', paymentIntent)
      res.send({
        clientSecret: paymentIntent.client_secret

      })
    })

    // payment 
    app.post('/payment', verifyjwt, async (req, res) => {
      const payment = req.body
      const result = await paymentCollection.insertOne(payment)
      const query = { _id: { $in: payment.items.map(id => new ObjectId(id)) } }
      const deleteItems = await cartCollection.deleteMany(query)

      // after a successful payment send an email to the user 
      sendEmail(payment.email) 
      res.send({ result, deleteItems })
    })

    // Admin Home data
    app.get('/admin-stats', async (req, res) => {
      const order = await paymentCollection.estimatedDocumentCount()
      const user = await usersCollection.estimatedDocumentCount()
      const totalMenu = await menusCollection.estimatedDocumentCount()


      const payment = await paymentCollection.find().toArray()
      const revenew = payment.reduce((sum, payment) => sum + payment.price, 0)

      res.send({ order, user, totalMenu, revenew })
    })
    
    // Admin Home data-for barChart and PieChart 
    app.get('/order-stats',verifyjwt,verifyUserRole, async (req, res) => {
      const summary = [
        {
          $lookup: {
            from: "menu",
            localField: "orderId",
            foreignField: "_id",
            as: "menuData"
          }
        },
        { $unwind: "$menuData" },
        {
          $group: {
            _id: "$menuData.category", // Group by category
            totalAmount: { $sum: "$menuData.price" }, // Sum the price
            count: { $sum: 1 } // Count the number of items
          }
        },
        {
          $project: {
            _id: 0,
            category: "$_id",
            totalAmount: 1,
            count: 1
          }
        }
      ]
      const result = await paymentCollection.aggregate(summary).toArray()
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('boss is sitting')
})

app.listen(port, () => {
  console.log('bistro boss is sitting')
})  