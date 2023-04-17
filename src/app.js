import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import express from "express";
import cors from "cors";
import Joi from "joi";
import dayjs from "dayjs";

const app = express();

app.use(express.json());
app.use(cors());

dotenv.config();

const mongoClient = new MongoClient(process.env.DATABASE_URL);
try {
  mongoClient.connect();
  console.log("MongoDB conectado!");
} catch (err) {
  console.log(err.message);
}
const db = mongoClient.db();

app.post("/participants", async (req, res) => {
  const participantSchema = Joi.object({
    name: Joi.string().required(),
  });

  const validation = participantSchema.validate(req.body);

  if (validation.error) {
    const error1 = validation.error.details.message;
    return res.status(422).send(error1);
  }

  try {
    const exists = await db.collection("participants").findOne(req.body);
    if (exists) return res.status(409).send("Nome de usuario indisponivel");

    await db.collection("participants").insertOne({
      name: req.body.name,
      lastStatus: Date.now(),
    });
    await db.collection("messages").insertOne({
      from: req.body.name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs(Date.now()).format("HH:mm:ss"),
    });
    res.sendStatus(201);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/participants", async (req, res) => {
  try {
    const participants = await db.collection("participants").find().toArray();
    res.send(participants).status(200);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const { user } = req.headers;

    const newMessage = {
        from: user,
        to,
        text,
        type,
    }

  const messageSchema = Joi.object({
    from: Joi.string().required(),
    to: Joi.string().required(),
    text: Joi.string().required(),
    type: Joi.string().required().valid("message", "private_message"),
  });

  const validation = messageSchema.validate(newMessage);
  const formattedTime = dayjs(Date.now()).format("HH:mm:ss");

  const exists = await db.collection("participants").findOne({ name: user })

  if ( !exists ) return res.sendStatus(422)

  if (validation.error)     {
    const error = validation.error.details.message
    return res.status(422).send(error);
  }


    try {

        await db.collection("messages").insertOne({
            ...newMessage, 
            time:formattedTime})
        res.sendStatus(201)
        

    } catch (err) {
      res.status(500).send(err.message);
    }
});

app.get("/messages", async (req, res) => {

    const { user } = req.headers
    const limit = {limit: Number(req.query.limit)}

    const limitSchema = Joi.object({
        limit: Joi.number().integer().min(1),
    })

    const validation = limitSchema.validate(limit)

    if (validation.error) {
        return res.sendStatus(422)
    }

    

  try {

    const messages = await db.collection("messages").find(
        { $or: [ 
            { to: "Todos" },
            { to: user },
            { from: user }
        ]}).limit(limit.limit || 0).toArray()
    res.sendStatus(200)

  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/status", async (req, res) => {

    const { user } = req.headers

    

    if ( !user ) return res.sendStatus(404)

    const exists = await db.collection("participants").findOne({ name: user })

    if ( !exists ) return res.sendStatus(404)

    await db.collection("participants").updateOne(
        { name: user },
        { $set: { lastStatus: Date.now() }}
    )

    res.sendStatus(200)

  try {

  } catch (err) {
    res.status(500).send(err.message);
  }
});

setInterval(async () => {

    const limitReach = Date.now() - 10000
  
    try {
  
      const afkUsers = await db.collection("participants")
        .find({ lastStatus: { $lte: limitReach } }).toArray()
  
      if (afkUsers.length > 0) {
        const afkMessages = afkUsers.map((participant) => {
          return {
            from: participant.name,
            to: 'Todos',
            text: 'sai da sala...',
            type: 'status',
            time: dayjs().format("HH:mm:ss")
          }
        })
  
        await db.collection("messages").insertMany(afkMessages)
        await db.collection("participants").deleteMany(
          { lastStatus: { $lte: limitReach } }
        )
      }
  
    } catch (error) {
      res.sendStatus(500)
    }
  
  }, 15000)

const PORT = 5000;

app.listen(PORT, () => console.log("sucesso!"));
