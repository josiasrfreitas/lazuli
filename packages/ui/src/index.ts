/**
 * Shared UI components. Portuguese-BR labels live near the UI (§2.1).
 * Baseline library ships when GRE-57 (P00) closes — not in backend issues (D-0036).
 */

export const UI_PACKAGE = "@lazuli/ui" as const;

export { Badge, badgeVariants } from "./components/badge";
export type { BadgeProps, BadgeVariant } from "./components/badge";
export {
  Alert,
  AlertAction,
  AlertContent,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  alertVariants,
} from "./components/alert";
export type {
  AlertActionProps,
  AlertContentProps,
  AlertDescriptionProps,
  AlertIconProps,
  AlertProps,
  AlertTitleProps,
  AlertVariant,
} from "./components/alert";
export { Button, buttonVariants } from "./components/button";
export type { ButtonProps, ButtonSize, ButtonVariant } from "./components/button";
export { HelloWorld } from "./components/hello-world";
export type { HelloWorldProps } from "./components/hello-world";
export { Input } from "./components/input";
export type { InputProps } from "./components/input";
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./components/select";
export type {
  SelectContentProps,
  SelectGroupProps,
  SelectItemProps,
  SelectLabelProps,
  SelectProps,
  SelectScrollDownButtonProps,
  SelectScrollUpButtonProps,
  SelectSeparatorProps,
  SelectSize,
  SelectTriggerProps,
  SelectValueProps,
} from "./components/select";
export { cn } from "./lib/utils";
export { Checkbox, checkboxVariants } from "./components/checkbox";
export type { CheckboxProps, CheckboxSize } from "./components/checkbox";
export { Textarea } from "./components/textarea";
export type { TextareaProps } from "./components/textarea";
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/tooltip";
export type { TooltipContentProps, TooltipProps, TooltipTriggerProps } from "./components/tooltip";
export {
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  dialogContentVariants,
} from "./components/dialog";
export type {
  DialogBackdropProps,
  DialogBodyProps,
  DialogCloseProps,
  DialogContentProps,
  DialogDescriptionProps,
  DialogFooterProps,
  DialogHeaderProps,
  DialogPortalProps,
  DialogProps,
  DialogTitleProps,
  DialogTriggerProps,
} from "./components/dialog";
export {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
  popoverContentVariants,
} from "./components/popover";
export type {
  PopoverCloseProps,
  PopoverContentProps,
  PopoverDescriptionProps,
  PopoverProps,
  PopoverSize,
  PopoverTitleProps,
  PopoverTriggerProps,
} from "./components/popover";
export {
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
  tabsListVariants,
  tabsTabVariants,
} from "./components/tabs";
export type {
  TabsListProps,
  TabsPanelProps,
  TabsProps,
  TabsSize,
  TabsTabProps,
  TabsVariant,
} from "./components/tabs";
export {
  Table,
  TableBody,
  TableCaption,
  TableContainer,
  TableFooter,
  TableHeader,
  TableRow,
  tableCellSpacing,
  useTableDensity,
} from "./components/table";
export type {
  TableBodyProps,
  TableCaptionProps,
  TableContainerProps,
  TableDensity,
  TableFooterProps,
  TableHeaderProps,
  TableProps,
  TableRowProps,
} from "./components/table";
export { TableCell, TableEmpty, TableHead } from "./components/table-cells";
export { TableSkeleton } from "./components/table-skeleton";
export type { TableSkeletonProps } from "./components/table-skeleton";
export type {
  TableCellProps,
  TableEmptyProps,
  TableHeadProps,
  TableSortDirection,
} from "./components/table-cells";
export { Label } from "./components/label";
export type { LabelProps } from "./components/label";
export { Field, FieldDescription, FieldError } from "./components/field";
export type { FieldDescriptionProps, FieldErrorProps, FieldProps } from "./components/field";
