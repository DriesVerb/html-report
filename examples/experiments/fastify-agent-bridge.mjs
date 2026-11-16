#!/usr/bin/env node
/**
 * fastify-agent-bridge.mjs - Fastify Two-Way Agent Bridge
 *
 * Provides a local Fastify server that bridges browser reports with your local
 * Antigravity agent CLI (`agy`) with ZERO external API keys needed.
 *
 * To install dependencies:
 *   npm install fastify @fastify/static @fastify/cors
 *
 * Usage:
 *   node fastify-agent-bridge.mjs --port 3001
 */

import { execFile } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

async function main() {
  let Fastify, fastifyStatic, fastifyCors;
  try {
    Fastify = (await import("fastify")).default;
    fastifyStatic = (await import("@fastify/static")).default;
    fastifyCors = (await import("@fastify/cors")).default;
  } catch (err) {
    console.error("Fastify is not installed yet. To run this bridge, install dependencies:");
    console.error("  npm install fastify @fastify/static @fastify/cors");
    process.exit(1);
  }

  const port = parseInt(process.argv.slice(2).find((a, i, arr) => arr[i - 1] === "--port") || "3001", 10);
  const fastify = Fastify({ logger: true });

  // 1. Enable CORS for cross-origin report communication
  await fastify.register(fastifyCors, { origin: "*" });

  // 2. Serve report files and PWA assets
  await fastify.register(fastifyStatic, {
    root: process.cwd(),
    prefix: "/"
  });

  // 3. Two-Way Street Agent Roast Endpoint (No API Key Required!)
  fastify.post("/api/agent-roast", async (req, reply) => {
    const { name, types, stats, persona } = req.body || {};
    const pokemonName = name || "Pokémon";
    const typesStr = Array.isArray(types) ? types.join("/") : (types || "Normal");
    const statsStr = stats
      ? `HP: ${stats.hp}, Atk: ${stats.attack}, Def: ${stats.defense}, SpAtk: ${stats.spatk}, SpDef: ${stats.spdef}, Speed: ${stats.speed}`
      : "";
    const personaStr = persona || "sarcastic";

    const personaInstructions = {
      sarcastic: "You are a ruthlessly sarcastic Pokémon critic. Deliver a single devastating, hilarious one-liner roast targeting its biology, design flaws, and embarrassing competitive weaknesses.",
      strategist: "You are an elite competitive Smogon strategist. Deliver a single sharp, witty one-liner roast dissecting its terrible tier viability, entry hazard vulnerability, and why it gets hard-countered in competitive play.",
      oak: "You are an exasperated, bewildered Professor Oak. Deliver a single hilarious one-liner lamenting 30 years of field research on this creature and why its biology makes no scientific sense.",
      hype: "You are an over-the-top, high-octane Esports shoutcaster. Deliver a single hilarious, hyper-energized one-liner screaming about this creature's stats."
    };

    const personaPrompt = personaInstructions[personaStr] || personaInstructions.sarcastic;
    const prompt = `${personaPrompt}
Target Pokémon: ${pokemonName} (${typesStr})
Base Stats: ${statsStr}
CRITICAL INSTRUCTION: Return ONLY the single witty one-liner roast. Do not include introductory text, quotation marks, or explanations.`;

    return new Promise((resolve) => {
      // Calls local agy CLI using the user's existing authenticated Antigravity account
      execFile("agy", ["--model", "Gemini 3.8 Flash (Low)", "-p", prompt], { timeout: 15000 }, (err, stdout) => {
        if (err) {
          reply.status(500).send({ error: err.message, fallback: true });
          return resolve();
        }
        const cleanOneliner = stdout.trim().replace(/^["']|["']$/g, "");
        resolve({
          ok: true,
          pokemon: pokemonName,
          oneliner: cleanOneliner,
          agent: "Google Antigravity (Gemini 3.8 Flash via agy CLI)",
          isLiveAI: true,
          persona: personaStr,
          timestamp: new Date().toISOString()
        });
      });
    });
  });

  await fastify.listen({ port, host: "127.0.0.1" });
  console.log(`⚡ Fastify Agent Bridge listening on http://127.0.0.1:${port}`);
}

main().catch(console.error);
