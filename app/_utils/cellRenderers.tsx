"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const RecipientNameCellRenderer = (params: any) => {
  const value = params.value;
  if (!value || typeof value !== "string" || !value.startsWith("[")) {
    return <span title={value}>{value}</span>;
  }

  let items: string[] = [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      items = parsed;
    } else {
      return <span title={value}>{value}</span>;
    }
  } catch (e) {
    return <span title={value}>{value}</span>;
  }

  if (items.length === 0) return null;

  if (items.length === 1) {
    return <span title={items[0]}>{items[0]}</span>;
  }

  const numVisible = 2;
  const displayItems = items.slice(0, numVisible);
  const remainingCount = items.length - numVisible;

  return (
    <div className="flex items-center justify-between h-full w-full pr-1">
      <div className="flex flex-col justify-center gap-0.5 overflow-hidden">
        {displayItems.map((item, index) => (
          <span key={index} className="truncate text-xs" title={item}>
            {item}
          </span>
        ))}
      </div>
      {remainingCount > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <div
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-medium cursor-pointer hover:bg-secondary/80 ml-1 border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              +{remainingCount}
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
              {items.slice(numVisible).map((item, idx) => (
                <div
                  key={idx}
                  className="text-xs py-1.5 px-1 border-b last:border-0 border-border/50"
                >
                  {item}
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};

export const ConsigneeNameCellRenderer = (params: any) => {
  const consigneeName = params.value;

  if (!params.data) {
    return <span>{consigneeName}</span>;
  }

  const recipientNameRaw = params.data.recipientName;
  let recipients: string[] = [];
  try {
    if (
      typeof recipientNameRaw === "string" &&
      recipientNameRaw.startsWith("[")
    ) {
      const parsed = JSON.parse(recipientNameRaw);
      if (Array.isArray(parsed)) {
        recipients = parsed;
      }
    } else if (recipientNameRaw) {
      recipients = [recipientNameRaw];
    }
  } catch (e) {
    // fallback
  }

  if (
    recipients.length === 0 &&
    typeof recipientNameRaw === "string" &&
    recipientNameRaw
  ) {
    recipients = [recipientNameRaw];
  }

  if (recipients.length === 0) {
    return <span>{consigneeName}</span>;
  }

  const numVisible = 1;
  const displayItems = recipients.slice(0, numVisible);
  const remainingCount = recipients.length - numVisible;

  return (
    <div className="flex flex-col justify-center h-full w-full pr-1 pt-1.25">
      <span
        className="truncate leading-tight font-medium"
        title={consigneeName}
      >
        {consigneeName}
      </span>
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground w-full -mt-0.5">
        {displayItems.map((item, index) => (
          <span key={index} className="truncate" title={item}>
            {item}
          </span>
        ))}
        {remainingCount > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <div
                className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-secondary text-[9px] font-medium cursor-pointer hover:bg-secondary/80 border border-border"
                onClick={(e) => e.stopPropagation()}
              >
                +{remainingCount}
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
                {recipients.slice(numVisible).map((item, idx) => (
                  <div
                    key={idx}
                    className="text-xs py-1.5 px-1 border-b last:border-0 border-border/50"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
};
