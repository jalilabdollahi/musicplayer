import React from "react";
import { ChevronRight, FileAudio, FolderPlus, Link2 } from "lucide-react";
import { Modal, cx } from "./ui";

interface AddMusicModalProps {
  canLinkFolder: boolean;
  onClose: () => void;
  onLinkFolder: () => void;
  onImportFolder: () => void;
  onImportFiles: () => void;
}

export function AddMusicModal({ canLinkFolder, onClose, onLinkFolder, onImportFolder, onImportFiles }: AddMusicModalProps) {
  const options = [
    ...(canLinkFolder
      ? [
          {
            icon: <Link2 size={20} />,
            title: "Link a folder",
            body: "Plays straight from disk and picks up new files on its own. Nothing is copied.",
            onClick: onLinkFolder,
            recommended: true,
          },
        ]
      : []),
    {
      icon: <FolderPlus size={20} />,
      title: "Import a folder",
      body: "Copies every song in a folder and its subfolders into the app.",
      onClick: onImportFolder,
      recommended: !canLinkFolder,
    },
    {
      icon: <FileAudio size={20} />,
      title: "Import files",
      body: "Pick individual songs, plus any .lrc lyrics files.",
      onClick: onImportFiles,
      recommended: false,
    },
  ];

  return (
    <Modal title="Add music" subtitle="Your files stay on this device." onClose={onClose} width="max-w-md">
      <div className="flex flex-col gap-2">
        {options.map((o) => (
          <button
            key={o.title}
            onClick={() => {
              onClose();
              o.onClick();
            }}
            className={cx(
              "flex items-center gap-4 rounded-2xl border p-4 text-left transition",
              o.recommended ? "border-accent/40 bg-accent/[0.08] hover:bg-accent/[0.13]" : "border-line hover:bg-white/[0.05]",
            )}
          >
            <span className={cx("grid size-11 shrink-0 place-items-center rounded-xl", o.recommended ? "bg-accent text-accent-fg" : "bg-white/[0.08]")}>
              {o.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 font-semibold">
                {o.title}
                {o.recommended && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">Best</span>}
              </span>
              <span className="mt-0.5 block text-[13px] leading-snug text-muted">{o.body}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-faint" />
          </button>
        ))}
      </div>
    </Modal>
  );
}
