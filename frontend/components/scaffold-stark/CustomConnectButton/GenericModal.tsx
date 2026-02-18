const GenericModal = ({
  children,
  modalId,
}: {
  children: React.ReactNode;
  className?: string;
  modalId: string;
}) => {
  return (
    <label htmlFor={modalId} className="modal backdrop-blur-sm cursor-pointer">
      <label
        className="modal-box rounded-xl border flex flex-col relative w-full max-w-sm p-6"
        style={{
          backgroundColor: "#1c2333",
          borderColor: "#30363d",
          minHeight: "auto",
        }}
      >
        <input className="h-0 w-0 absolute top-0 left-0" />
        {children}
      </label>
    </label>
  );
};

export default GenericModal;
