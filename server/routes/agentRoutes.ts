import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IContext extends Document {
  userId: mongoose.Types.ObjectId;
  conversationId: string;
  data: {
    request: string;
    context: any[];
    timestamp: Date;
  };
}

const contextSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  conversationId: {
    type: String,
    required: true
  },
  data: {
    type: Object,
    required: true,
    default: {
      request: '',
      context: [],
      timestamp: Date.now()
    }
  }
}, { timestamps: true });

export const Context: Model<IContext> = mongoose.model<IContext>('Context', contextSchema);
