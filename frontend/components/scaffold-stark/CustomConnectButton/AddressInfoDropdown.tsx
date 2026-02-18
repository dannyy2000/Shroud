import { useRef, useState } from "react";
import CopyToClipboard from "react-copy-to-clipboard";
import {
  ArrowLeftEndOnRectangleIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  DocumentDuplicateIcon,
  QrCodeIcon,
} from "@heroicons/react/24/outline";
import { useLocalStorage } from "usehooks-ts";
import {
  Avatar,
  isStarknetName,
} from "~~/components/scaffold-stark";
import { useOutsideClick } from "~~/hooks/scaffold-stark";
import { getTargetNetworks, notification } from "~~/utils/scaffold-stark";
import { Address } from "@starknet-react/chains";
import { useDisconnect, useNetwork } from "@starknet-react/core";
import { useScaffoldStarkProfile } from "~~/hooks/scaffold-stark/useScaffoldStarkProfile";

type AddressInfoDropdownProps = {
  address: Address;
  blockExplorerAddressLink: string | undefined;
  displayName: string;
};

export const AddressInfoDropdown = ({
  address,
  displayName,
  blockExplorerAddressLink,
}: AddressInfoDropdownProps) => {
  const { disconnect } = useDisconnect();
  const [addressCopied, setAddressCopied] = useState(false);
  const { data: profile } = useScaffoldStarkProfile(address);
  const { chain } = useNetwork();
  const dropdownRef = useRef<HTMLDetailsElement>(null);

  const closeDropdown = () => {
    dropdownRef.current?.removeAttribute("open");
  };

  useOutsideClick(dropdownRef, closeDropdown);

  const [, setWasDisconnectedManually] = useLocalStorage<boolean>(
    "wasDisconnectedManually",
    false,
    { initializeWithValue: false },
  );

  const handleDisconnect = () => {
    try {
      disconnect();
      localStorage.removeItem("lastUsedConnector");
      localStorage.removeItem("lastConnectionTime");
      setWasDisconnectedManually(true);
      window.dispatchEvent(new Event("manualDisconnect"));
      notification.success("Disconnected successfully!");
    } catch (err) {
      console.log(err);
      notification.error("Disconnect failed!");
    }
  };

  const shortAddr = profile?.name || address?.slice(0, 6) + "..." + address?.slice(-4);

  return (
    <details ref={dropdownRef} className="dropdown dropdown-end leading-3">
      <summary
        className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border transition-colors"
        style={{
          backgroundColor: "#161b22",
          borderColor: "#30363d",
          color: "#e6edf3",
        }}
      >
        <Avatar
          address={address}
          size={24}
          profilePicture={profile?.profilePicture}
        />
        <span className="text-sm font-medium">
          {isStarknetName(displayName) ? displayName : shortAddr}
        </span>
        <ChevronDownIcon className="h-4 w-4" style={{ color: "#8b949e" }} />
      </summary>
      <ul
        className="dropdown-content z-[2] p-2 mt-2 rounded-lg gap-1 border"
        style={{
          backgroundColor: "#1c2333",
          borderColor: "#30363d",
          minWidth: "200px",
        }}
      >
        <li>
          {addressCopied ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm" style={{ color: "#3fb950" }}>
              <CheckCircleIcon className="h-4 w-4" />
              <span>Copied!</span>
            </div>
          ) : (
            //@ts-ignore
            <CopyToClipboard
              text={address}
              onCopy={() => {
                setAddressCopied(true);
                setTimeout(() => setAddressCopied(false), 800);
              }}
            >
              <button
                className="flex items-center gap-2 px-3 py-2 text-sm w-full rounded-md transition-colors"
                style={{ color: "#e6edf3" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#30363d"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <DocumentDuplicateIcon className="h-4 w-4" />
                <span>Copy address</span>
              </button>
            </CopyToClipboard>
          )}
        </li>
        <li>
          <label
            htmlFor="qrcode-modal"
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer transition-colors"
            style={{ color: "#e6edf3" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#30363d"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <QrCodeIcon className="h-4 w-4" />
            <span>View QR Code</span>
          </label>
        </li>
        {chain.network !== "devnet" && blockExplorerAddressLink && (
          <li>
            <a
              target="_blank"
              href={blockExplorerAddressLink}
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors"
              style={{ color: "#e6edf3" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#30363d"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              <span>Block Explorer</span>
            </a>
          </li>
        )}
        <li className="pt-1 mt-1" style={{ borderTop: "1px solid #30363d" }}>
          <button
            className="flex items-center gap-2 px-3 py-2 text-sm w-full rounded-md transition-colors"
            style={{ color: "#f85149" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#30363d"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            onClick={handleDisconnect}
          >
            <ArrowLeftEndOnRectangleIcon className="h-4 w-4" />
            <span>Disconnect</span>
          </button>
        </li>
      </ul>
    </details>
  );
};
