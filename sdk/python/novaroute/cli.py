#!/usr/bin/env python3
"""
NovaRoute CLI — Manage your NovaRoute server from the terminal.

Usage:
    novaroute status              Show server status
    novaroute models              List available models
    novaroute providers           List providers
    novaroute keys                Manage API keys
    novaroute chat                Start interactive chat
    novaroute a2a <skill>         Send A2A request
    novaroute health              Check server health
    novaroute config              Show/set configuration
"""

import sys
import json
import argparse
from typing import Optional

try:
    from novaroute import NovaRoute
except ImportError:
    # Running from source
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from novaroute import NovaRoute


def get_client(args) -> NovaRoute:
    base_url = args.url or "http://localhost:20126"
    api_key = args.api_key
    return NovaRoute(base_url=base_url, api_key=api_key)


def cmd_status(args):
    """Show server status."""
    client = get_client(args)
    try:
        status = client.health()
        print("🟢 Server Status: OK")
        print(f"   URL: {client.base_url}")
        print(f"   Response: {json.dumps(status, indent=2)}")
    except Exception as e:
        print(f"🔴 Server Error: {e}")


def cmd_models(args):
    """List available models."""
    client = get_client(args)
    try:
        models = client.models.list()
        print(f"📋 Available Models ({len(models.data)}):")
        for model in models.data[:args.limit]:
            print(f"   • {model.id} ({model.owned_by or 'unknown'})")
        if len(models.data) > args.limit:
            print(f"   ... and {len(models.data) - args.limit} more")
    except Exception as e:
        print(f"❌ Error: {e}")


def cmd_providers(args):
    """List providers."""
    client = get_client(args)
    try:
        result = client._get("/api/providers")
        providers = result.get("providers", result) if isinstance(result, dict) else result
        if isinstance(providers, list):
            print(f"🔌 Providers ({len(providers)}):")
            for p in providers[:args.limit]:
                name = p.get("name", p.get("id", "unknown"))
                print(f"   • {name}")
        else:
            print(f"   Response: {json.dumps(providers, indent=2)[:500]}")
    except Exception as e:
        print(f"❌ Error: {e}")


def cmd_chat(args):
    """Start interactive chat."""
    client = get_client(args)
    model = args.model or "openai/gpt-4o"
    print(f"💬 Interactive Chat (model: {model})")
    print(f"   Server: {client.base_url}")
    print(f"   Type 'exit' to quit, 'model <name>' to switch model\n")

    messages = []

    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n👋 Bye!")
            break

        if not user_input:
            continue

        if user_input.lower() == "exit":
            print("👋 Bye!")
            break

        if user_input.lower().startswith("model "):
            model = user_input[6:].strip()
            print(f"🔄 Switched to model: {model}")
            continue

        if user_input.lower() == "clear":
            messages = []
            print("🗑️  Chat cleared")
            continue

        messages.append({"role": "user", "content": user_input})

        try:
            if args.stream:
                print("Assistant: ", end="", flush=True)
                for chunk in client.chat.completions.stream(
                    model=model, messages=messages
                ):
                    if chunk.choices and chunk.choices[0].delta:
                        content = chunk.choices[0].delta.get("content", "")
                        if content:
                            print(content, end="", flush=True)
                print()
            else:
                response = client.chat.completions.create(
                    model=model, messages=messages
                )
                print(f"Assistant: {response.content}")
                messages.append({"role": "assistant", "content": response.content})
        except Exception as e:
            print(f"❌ Error: {e}")
            messages.pop()  # Remove failed user message


def cmd_a2a(args):
    """Send A2A request."""
    client = get_client(args)
    skill = args.skill or "health-report"
    prompt = args.prompt or "Health check"

    try:
        result = client.a2a.send(
            skill=skill,
            messages=[{"role": "user", "content": prompt}],
        )
        if "result" in result:
            artifacts = result["result"].get("artifacts", [])
            for artifact in artifacts:
                print(artifact.get("content", ""))
        else:
            print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"❌ Error: {e}")


def cmd_health(args):
    """Check server health."""
    client = get_client(args)
    try:
        health = client.health()
        print(json.dumps(health, indent=2))
    except Exception as e:
        print(f"❌ Error: {e}")


def cmd_config(args):
    """Show/set configuration."""
    if args.set:
        key, value = args.set.split("=", 1)
        print(f"⚙️  Setting {key} = {value}")
        # Would persist to config file
    else:
        print("⚙️  NovaRoute CLI Configuration:")
        print(f"   Base URL: {args.url or 'http://localhost:20126'}")
        print(f"   API Key: {'***' if args.api_key else 'Not set'}")
        print(f"   Stream: {args.stream}")


def main():
    parser = argparse.ArgumentParser(
        prog="novaroute",
        description="NovaRoute CLI — Manage your AI gateway",
    )
    parser.add_argument("--url", "-u", help="Server URL")
    parser.add_argument("--api-key", "-k", help="API key")
    parser.add_argument("--stream", "-s", action="store_true", default=True, help="Stream responses")

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # status
    subparsers.add_parser("status", help="Show server status")

    # models
    models_parser = subparsers.add_parser("models", help="List available models")
    models_parser.add_argument("--limit", "-l", type=int, default=20, help="Max models to show")

    # providers
    providers_parser = subparsers.add_parser("providers", help="List providers")
    providers_parser.add_argument("--limit", "-l", type=int, default=20, help="Max providers to show")

    # chat
    chat_parser = subparsers.add_parser("chat", help="Start interactive chat")
    chat_parser.add_argument("--model", "-m", default="openai/gpt-4o", help="Model to use")

    # a2a
    a2a_parser = subparsers.add_parser("a2a", help="Send A2A request")
    a2a_parser.add_argument("skill", nargs="?", default="health-report", help="Skill name")
    a2a_parser.add_argument("prompt", nargs="?", default="Health check", help="Prompt")

    # health
    subparsers.add_parser("health", help="Check server health")

    # config
    config_parser = subparsers.add_parser("config", help="Show/set configuration")
    config_parser.add_argument("--set", "-s", help="Set config value (key=value)")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    commands = {
        "status": cmd_status,
        "models": cmd_models,
        "providers": cmd_providers,
        "chat": cmd_chat,
        "a2a": cmd_a2a,
        "health": cmd_health,
        "config": cmd_config,
    }

    if args.command in commands:
        commands[args.command](args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
