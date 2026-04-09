import SmartResultRenderer from "@/components/core/chatComponents/SmartResultRenderer";
import { MarkdownField } from "@/modals/IOModal/components/chatView/chatMessage/components/edit-message";

type CustomMarkdownFieldProps = {
  isAudioMessage: boolean;
  chat: any;
  isEmpty: boolean;
  chatMessage: string;
  editedFlag: React.ReactNode;
};

export const CustomMarkdownField = ({
  isAudioMessage,
  chat,
  isEmpty,
  chatMessage,
  editedFlag,
}: CustomMarkdownFieldProps) => {
  // Use SmartResultRenderer for bot messages with structured content.
  // Falls back to standard MarkdownField for simple text or empty messages.
  if (!isEmpty && !chat.isSend && chatMessage?.trim()) {
    return (
      <>
        <SmartResultRenderer
          text={chatMessage}
          fallback={
            <MarkdownField
              isAudioMessage={isAudioMessage}
              chat={chat}
              isEmpty={isEmpty}
              chatMessage={chatMessage}
              editedFlag={editedFlag}
            />
          }
        />
        {editedFlag}
      </>
    );
  }

  return (
    <MarkdownField
      isAudioMessage={isAudioMessage}
      chat={chat}
      isEmpty={isEmpty}
      chatMessage={chatMessage}
      editedFlag={editedFlag}
    />
  );
};
