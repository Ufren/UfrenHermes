import { ipcMain } from "electron";

import {
  chatCompletionRequestSchema,
  chatCompletionResponseSchema,
  ipcChannels
} from "@ufren/shared";

import type { ChatService } from "../chat/chat-service.js";

export function registerChatHandlers(chatService: ChatService): void {
  ipcMain.handle(ipcChannels.chatComplete, async (_, payload: unknown) => {
    const request = chatCompletionRequestSchema.parse(payload ?? {});
    const response = await chatService.complete(request);
    return chatCompletionResponseSchema.parse(response);
  });
}
