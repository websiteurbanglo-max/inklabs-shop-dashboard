"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import FileUpload from "./file-upload";
import type { PlatformConfig } from "@/models/types";

interface OrderFormProps {
  platformConfig: PlatformConfig;
}

interface PriceResult {
  unitPrice: number;
  subtotal: number;
  total: number;
  currency: string;
  ruleSource: "shop" | "global";
  appliedRuleId: string;
}

export default function OrderForm({ platformConfig }: OrderFormProps) {
  const router = useRouter();

  // Form state
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");

  // Pricing state
  const [priceResult, setPriceResult] = useState<PriceResult | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [calculatingPrice, setCalculatingPrice] = useState(false);

  // Submission state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Get variant group for selected size
  const getVariantGroup = (size: number): string | null => {
    for (const group of platformConfig.variantGroups) {
      if (group.sizes.includes(size)) {
        return group.key;
      }
    }
    return null;
  };

  // Calculate price when size/quantity changes
  const calculatePrice = useCallback(
    async (size: number | null, qty: number) => {
      if (!size || !qty) return;

      const variantGroup = getVariantGroup(size);
      if (!variantGroup) {
        setPricingError(
          "This size does not belong to a known variant group."
        );
        setPriceResult(null);
        return;
      }

      setCalculatingPrice(true);
      setPricingError(null);
      setPriceResult(null);

      try {
        const res = await fetch("/api/pricing/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variantGroup, quantity: qty }),
        });

        const data = await res.json();

        if (!res.ok) {
          setPricingError(
            data.error ||
              "No pricing rule found for this combination. Contact the platform administrator."
          );
          return;
        }

        setPriceResult(data);
      } catch {
        setPricingError("Failed to calculate price. Please try again.");
      } finally {
        setCalculatingPrice(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [platformConfig.variantGroups]
  );

  const handleSizeSelect = (size: number) => {
    setSelectedSize(size);
    calculatePrice(size, quantity);
  };

  const handleQuantityChange = (qty: number) => {
    const newQty = Math.max(1, qty);
    setQuantity(newQty);
    if (selectedSize) {
      calculatePrice(selectedSize, newQty);
    }
  };

  const handleSubmit = async () => {
    if (!uploadedUrl || !selectedSize || !quantity || !priceResult) {
      toast.error("Please complete all required steps");
      return;
    }

    setSubmitting(true);
    setConfirmOpen(false);

    try {
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawImageUrl: uploadedUrl,
          designImageUrl: uploadedUrl,
          sizeInInches: selectedSize,
          quantity,
          customerName: customerName || undefined,
          customerEmail: customerEmail || undefined,
          notes: notes || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create order");
      }

      toast.success("Order created successfully!");
      router.push(`/orders/${data.order.orderId}`);
    } catch (err) {
      toast.error((err as Error).message);
      setSubmitting(false);
    }
  };

  const canSubmit =
    !!uploadedUrl && !!selectedSize && quantity >= 1 && !!priceResult;

  // All sizes from variant groups
  const allSizes = platformConfig.variantGroups.flatMap((g) => g.sizes);
  const quantityPresets = [1, 5, 10, 25, 50, 100];

  return (
    <div className="max-w-2xl space-y-6">
      {/* Step 1: Upload Design */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
            1
          </div>
          <h2 className="font-semibold text-gray-900">Upload Design</h2>
          {uploadedUrl && (
            <svg
              className="w-5 h-5 text-green-500 ml-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>
        <FileUpload
          accept="image/png,image/jpeg"
          maxSizeMB={20}
          onUpload={setUploadedUrl}
          previewUrl={uploadedUrl}
          onRemove={() => setUploadedUrl(null)}
        />
      </Card>

      {/* Step 2: Select Size */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`w-7 h-7 rounded-full text-white flex items-center justify-center text-sm font-bold flex-shrink-0 ${
              selectedSize ? "bg-green-500" : "bg-indigo-600"
            }`}
          >
            {selectedSize ? "✓" : "2"}
          </div>
          <h2 className="font-semibold text-gray-900">Select Size</h2>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {platformConfig.variantGroups.map((group) => (
            <div key={group.key} className="space-y-2">
              <p className="text-xs font-medium text-gray-500">{group.label}</p>
              <div className="grid grid-cols-2 gap-2">
                {group.sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => handleSizeSelect(size)}
                    className={`p-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      selectedSize === size
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                        : "border-gray-100 hover:border-gray-300 text-gray-700"
                    }`}
                  >
                    {size}&quot;
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Step 3: Quantity */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
            3
          </div>
          <h2 className="font-semibold text-gray-900">Enter Quantity</h2>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2 mb-4">
          {quantityPresets.map((preset) => (
            <button
              key={preset}
              onClick={() => handleQuantityChange(preset)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                quantity === preset
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-700 border-gray-200 hover:border-indigo-300"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Stepper input */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleQuantityChange(quantity - 1)}
            disabled={quantity <= 1}
            className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            −
          </button>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) =>
              handleQuantityChange(parseInt(e.target.value, 10) || 1)
            }
            className="w-20 text-center px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={() => handleQuantityChange(quantity + 1)}
            className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"
          >
            +
          </button>
        </div>
      </Card>

      {/* Step 4: Price Preview */}
      {(selectedSize && quantity >= 1) && (
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              4
            </div>
            <h2 className="font-semibold text-gray-900">Pricing</h2>
          </div>

          {calculatingPrice ? (
            <div className="flex items-center gap-2 text-gray-400">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm">Calculating price...</span>
            </div>
          ) : pricingError ? (
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg">
              <p className="text-sm text-amber-800">{pricingError}</p>
            </div>
          ) : priceResult ? (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Unit Price</span>
                <span className="text-gray-900">
                  {formatCurrency(priceResult.unitPrice)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Quantity</span>
                <span className="text-gray-900">×{quantity}</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-gray-100">
                <span className="font-semibold text-gray-800">
                  Estimated Total
                </span>
                <span className="text-2xl font-bold text-indigo-600">
                  {formatCurrency(priceResult.total)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    priceResult.ruleSource === "shop"
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {priceResult.ruleSource === "shop"
                    ? "Shop pricing"
                    : "Standard pricing"}
                </span>
              </div>
            </div>
          ) : null}
        </Card>
      )}

      {/* Step 5: Customer Details */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
            5
          </div>
          <h2 className="font-semibold text-gray-900">
            Customer Details{" "}
            <span className="text-gray-400 font-normal text-sm">(Optional)</span>
          </h2>
        </div>

        <div className="space-y-4">
          <Input
            label="Customer Name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="e.g., Rahul Sharma"
          />
          <Input
            label="Customer Email"
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="customer@example.com"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
        </div>
      </Card>

      {/* Submit */}
      <Button
        onClick={() => setConfirmOpen(true)}
        disabled={!canSubmit || submitting}
        size="lg"
        className="w-full"
      >
        Place Order
      </Button>

      {!canSubmit && (
        <p className="text-xs text-gray-400 text-center">
          Please upload a design, select a size, and enter a quantity to
          continue.
        </p>
      )}

      {/* Confirmation dialog */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm Order"
        description="Please review your order details before confirming."
      >
        <div className="space-y-3">
          {uploadedUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={uploadedUrl}
              alt="Design preview"
              className="w-full max-h-32 object-contain rounded-lg bg-gray-50 border border-gray-100"
            />
          )}

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Size:</span>
              <span className="ml-2 font-medium">{selectedSize}&quot; inches</span>
            </div>
            <div>
              <span className="text-gray-500">Quantity:</span>
              <span className="ml-2 font-medium">{quantity}</span>
            </div>
            {customerName && (
              <div className="col-span-2">
                <span className="text-gray-500">Customer:</span>
                <span className="ml-2 font-medium">{customerName}</span>
              </div>
            )}
          </div>

          {priceResult && (
            <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Total</span>
              <span className="text-lg font-bold text-indigo-600">
                {formatCurrency(priceResult.total)}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setConfirmOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Confirm Order
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
