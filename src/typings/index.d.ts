import type {
    ClientEvents,
    GuildTextBasedChannel,
    Message,
    TextBasedChannel,
} from "discord.js-selfbot-v13";

import { BaseAgent } from "@/structure/BaseAgent.ts";

export type MaybePromise<T> = T | Promise<T>;

interface BaseParams {
    agent: BaseAgent;
}

export interface FeatureFnParams extends BaseParams { }

export interface FeatureProps {
    name: string;
    cooldown: () => number;
    condition: (args: FeatureFnParams) => MaybePromise<boolean>;
    run: (args: FeatureFnParams) => MaybePromise<unknown>;
}

type HandlerProps = {
    run: (args: BaseParams) => MaybePromise<void>;
}

interface SendMessageOptions {
    channel: TextBasedChannel;
    prefix?: string;
    typing?: number;
    skipLogging?: boolean;
}

interface AwaitResponseOptions {
    channel?: GuildTextBasedChannel | TextBasedChannel;
    filter: (message: Message) => boolean;
    /**
     * Function to trigger the action that prompts the response.
     * Optional for cases where we only want to listen.
     */
    trigger?: () => void | Promise<void>;
    time?: number;
    max?: number;
    /**
     * Set to true to track if the response was not received
     */
    expectResponse?: boolean;
}

export type {
    HandlerProps,
    SendMessageOptions,
    AwaitResponseOptions,
    BaseParams,
};
