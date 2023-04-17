import dotenv from "dotenv"
import { MongoClient, ObjectId } from "mongodb";
import express from "express";
import cors from 'cors'
import Joi from 'joi';
import dayjs from 'dayjs';

const app = express()


app.use(express.json())
app.use(cors())


dotenv.config()

const mongoClient = new MongoClient(process.env.DATABASE_URL)
try {
     mongoClient.connect()
    console.log("MongoDB conectado!")
} catch (err) {
    console.log(err.message)
}
const db = mongoClient.db()

app.post("/participants", async (req, res) => {
    
    const participantSchema = Joi.object({
        name: Joi.string().required()
    })

    const validation = participantSchema.validate(req.body)

    if (validation.error) {
        const error1 = validation.error.details.message
        return res.status(422).send(error1)
    }

    try {

        const exists = await db.collection("participants").findOne(req.body)
        if (exists) return res.status(409).send("Nome de usuario indisponivel")

        await db.collection("participants").insertOne({
            name: req.body.name,
            lastStatus: Date.now()
        })
        await db.collection("messages").insertOne({
            from: req.body.name,
		    to: 'Todos',
		    text: 'entra na sala...',
            type: 'status',
            time: dayjs().format()
        })
        res.sendStatus(201)

    } catch (err) {
        res.status(500).send(err.message)
    }
})

const PORT = 5000

app.listen(PORT, () => console.log("sucesso!"))