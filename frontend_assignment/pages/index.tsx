import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { providers } from "ethers"
import { useForm } from "react-hook-form"
import { object, string, number } from 'yup'
import Head from "next/head"
import React from "react"
import styles from "../styles/Home.module.css"

export default function Home() {
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")

    const {register, handleSubmit} = useForm({
        defaultValues: {
          Name: "",
          Age: "",
          Address:"",
          Message:""
        }
      });

    let schema = object({
        Name: string().required(),
        Age: number().required().positive().integer(),
        Address: string().required(),
        Message: string().required()
      });

    async function greet() {
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        const greeting = "Hello world"

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }
    }

    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>

                <div className={styles.logs}>{logs}</div>

                <div className={styles.formDiv}>
                    <form
                        onSubmit= { handleSubmit((data) => { console.log(JSON.stringify(data) )
                        schema.validate(JSON.stringify(data))}
                    )}>

                        <label>Name</label>
                        <input {...register("Name")} defaultValue="Name" /><br></br>

                        <label>Age</label>
                        <input {...register("Age")} defaultValue="Age" /><br></br>

                        <label>Address</label>
                        <input {...register("Address")} defaultValue="Address" /><br></br>

                        <label>Message</label>
                        <input {...register("Message")} defaultValue="Message" /><br></br>

                        <input type="submit" name="submit"/>

                    </form>     

                    <p className={styles.description}>A simple implementaion of a greeter</p> 

                    <div onClick={() => greet()} className={styles.button}>Greet</div>
                </div>
            </main>
        </div>
    )
}
