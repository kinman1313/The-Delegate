import mongoose, { Document, Schema } from 'mongoose';

// Interface for the Context document
export interface IContext extends Document {
  userId: mongoose.Types.ObjectId;
  conversationId: string;
  data: {
    request: string;
    context: any[];
    timestamp: Date;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

// Schema for the Context model
const ContextSchema = new Schema<IContext>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User'
    },
    conversationId: {
      type: String,
      required: true
    },
    data: {
      type: Schema.Types.Mixed,
      required: true
    }
  },
  { timestamps: true }
);

// Export the Context model
export const Context = mongoose.model<IContext>('Context', ContextSchema);
