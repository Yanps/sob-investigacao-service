export interface WebhookLog {
    traceId: string;
    headers: any;
    payload: any;
    receivedAt: Date;
}

export interface ProcessingJob {
    traceId: string;
    status: "pending" | "processing" | "done" | "error";
    webhookLogRef: string;
    createdAt: Date;
    updatedAt: Date;
    conversationId?: string;
    agentPhoneNumberId?: string;
    sessionId?: string | null;
}
