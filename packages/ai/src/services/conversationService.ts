import {
  type CollectedData,
  type CollectedFilledData,
  type ExtraStreamData,
  type Transcript,
  shouldSkipValidation,
  transcriptSchema,
} from "@convoform/db/src/schema";
import { OpenAIStream, StreamData, StreamingTextResponse } from "ai";

import { CONVERSATION_END_MESSAGE } from "@convoform/common";
import type { ChatCompletionMessageParam } from "openai/resources";
import { OpenAIService } from "./openAIService";

export class ConversationService extends OpenAIService {
  public getNextEmptyField(collectedData: CollectedData[]) {
    return collectedData.find((field) => field.fieldValue === null);
  }

  public async generateQuestion({
    formOverview,
    currentField,
    collectedData,
    extraCustomStreamData,
    transcript,
    onStreamFinish,
  }: {
    formOverview: string;
    currentField: CollectedData;
    collectedData: CollectedData[];
    extraCustomStreamData: ExtraStreamData;
    transcript: Transcript[];
    onStreamFinish?: (completion: string) => void;
  }) {
    const fieldsWithData = collectedData.filter(
      (field) => field.fieldValue !== null,
    ) as CollectedFilledData[];
    const isFirstQuestion =
      fieldsWithData.length === 0 && transcript.length === 1;

    const systemMessage = this.getGenerateQuestionPromptMessage({
      formOverview,
      currentField,
      fieldsWithData,
      isFirstQuestion,
    });
    const openAiResponse = await this.getOpenAIResponseStream([
      systemMessage,
      ...transcript.map(({ role, content }) => ({
        role,
        content,
      })),
    ]);

    // Instantiate the StreamData. This is used to send extra custom data in the response stream
    const data = new StreamData();

    // Without safeJsonString this it will throw type error for Date type used in JSON
    const safeJsonString = JSON.stringify({ ...extraCustomStreamData });
    data.append(JSON.parse(safeJsonString));

    // Convert the response into a friendly text-stream
    const stream = OpenAIStream(openAiResponse, {
      onFinal(completion) {
        // IMPORTANT! you must close StreamData manually or the response will never finish.
        data.close();
        onStreamFinish?.(completion);
      },
    });
    // Respond with the stream
    return new StreamingTextResponse(
      stream,
      {
        headers: { "Access-Control-Allow-Origin": "*" },
      },
      data,
    );
  }

  /**
   * There should be at least 3 transcript messages in the conversation to extract answer,
   * 1. Initial user message e.g. "Hi", "start the form submission"
   * 2. AI assistant message e.g. "Hello! To start with, may I have your full name for the job application as a full stack engineer?"
   * 3. User message e.g. "My name is Utkarsh Anand"
   */
  public async extractAnswer({
    transcript,
    currentField,
    formOverview,
  }: {
    transcript: Transcript[];
    currentField: CollectedData;
    formOverview: string;
  }) {
    let isAnswerExtracted = false;
    let extractedAnswer = "";
    let reasonForFailure: string | null = null;
    let otherFieldsData: CollectedFilledData[] = [];
    const skipValidation = shouldSkipValidation(
      currentField.fieldConfiguration.inputType,
    );

    const isValidTranscript = transcriptSchema
      .array()
      .min(3)
      .safeParse(transcript).success;
    if (!isValidTranscript) {
      throw new Error("Does not have enough transcript data to extract answer");
    }

    if (skipValidation) {
      return {
        isAnswerExtracted: true,
        // biome-ignore lint/style/noNonNullAssertion: Already checked above
        extractedAnswer: transcript[transcript.length - 1]!.content,
        reasonForFailure,
        otherFieldsData,
      };
    }

    const systemMessage = this.getExtractAnswerPromptMessage({
      transcript,
      currentField,
      formOverview,
    }) as ChatCompletionMessageParam;
    const message = {
      role: "user",
      content: "Extract answer",
    } as ChatCompletionMessageParam;
    const openAiResponse = await this.getOpenAIResponseJSON([
      systemMessage,
      message,
    ]);
    const responseJson = openAiResponse.choices[0]?.message.content;
    if (responseJson) {
      try {
        const parsedJson = JSON.parse(responseJson);
        isAnswerExtracted = parsedJson.isAnswerExtracted ?? isAnswerExtracted;
        extractedAnswer = parsedJson.extractedAnswer ?? extractedAnswer;
        reasonForFailure = parsedJson.reasonForFailure ?? reasonForFailure;
        otherFieldsData = Array.isArray(parsedJson.otherFieldsData)
          ? parsedJson.otherFieldsData
          : otherFieldsData;
      } catch (_) {
        /* empty */
      }
    }

    return {
      isAnswerExtracted,
      extractedAnswer,
      reasonForFailure,
      otherFieldsData,
    };
  }

  public async generateEndMessage({
    extraCustomStreamData,
  }: {
    extraCustomStreamData: Record<string, any>;
    onStreamFinish?: (completion: string) => void;
  }) {
    // Instantiate the StreamData. This is used to send extra custom data in the response stream
    const data = new StreamData();
    data.append(extraCustomStreamData);

    // Convert the response into a friendly text-stream
    const endMessage = CONVERSATION_END_MESSAGE;
    const stream = new ReadableStream({
      async pull(controller) {
        controller.enqueue(`0:"${endMessage}"`);
        data.close();
        controller.close();
      },
    });
    // Respond with the stream
    return new StreamingTextResponse(
      stream,
      { headers: { "Access-Control-Allow-Origin": "*" } },
      data,
    );
  }

  public async generateConversationName({
    formOverview,
    fieldsWithData,
  }: {
    formOverview: string;
    fieldsWithData: CollectedFilledData[];
  }) {
    const systemMessage = this.getGenerateConversationNamePromptMessage({
      formOverview,
      fieldsWithData,
    }) as ChatCompletionMessageParam;

    const openAiResponse = await this.getOpenAIResponseJSON([
      systemMessage,
      {
        role: "user",
        content: "Generate conversation name",
      },
    ]);

    let conversationName = "Finished conversation";

    const responseJson = openAiResponse.choices[0]?.message.content;
    if (responseJson) {
      try {
        const parsedJson = JSON.parse(responseJson);
        conversationName = parsedJson.conversationName ?? conversationName;
      } catch (_) {
        /* empty */
      }
    }

    return { conversationName };
  }
}
